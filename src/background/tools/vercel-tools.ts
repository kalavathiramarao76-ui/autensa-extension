import { Tool } from '@/shared/types';
import * as vercel from '../api/vercel';

export const vercelTools: Tool[] = [
  {
    name: 'vercel_list_projects',
    description: 'List Vercel projects for the authenticated user',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of projects to return', default: 10 },
      },
    },
    async execute(args: { limit?: number }) {
      const result = await vercel.listProjects(args.limit || 10);
      const projects = result.projects || [];
      return {
        success: true,
        data: projects.map((p: any) => ({
          name: p.name || 'Unknown',
          id: p.id || '',
          framework: p.framework || null,
          updatedAt: p.updatedAt || null,
          url: p.name ? `https://${p.name}.vercel.app` : null,
        })),
      };
    },
  },
  {
    name: 'vercel_list_deployments',
    description: 'List recent Vercel deployments, optionally filtered by project',
    input_schema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID to filter by (optional)' },
        limit: { type: 'number', description: 'Number of deployments to return', default: 10 },
      },
    },
    async execute(args: { project_id?: string; limit?: number }) {
      const result = await vercel.listDeployments(args.project_id, args.limit || 10);
      const deployments = result.deployments || [];
      return {
        success: true,
        data: deployments.map((d: any) => ({
          id: d.uid || d.id || '',
          name: d.name || 'Unknown',
          state: d.state || d.readyState || 'unknown',
          url: d.url ? `https://${d.url}` : null,
          created: d.created || d.createdAt || null,
          target: d.target || null,
          source: d.source || null,
        })),
      };
    },
  },
  {
    name: 'vercel_get_deployment',
    description: 'Get details of a specific Vercel deployment',
    input_schema: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string', description: 'Deployment ID' },
      },
      required: ['deployment_id'],
    },
    async execute(args: { deployment_id: string }) {
      const d = await vercel.getDeployment(args.deployment_id);
      return {
        success: true,
        data: {
          id: d.id,
          name: d.name,
          state: d.readyState,
          url: d.url ? `https://${d.url}` : null,
          created: d.created,
          buildingAt: d.buildingAt,
          ready: d.ready,
          target: d.target,
          error: d.error,
        },
      };
    },
  },
  {
    name: 'vercel_get_deployment_logs',
    description: 'Get build logs/events for a Vercel deployment',
    input_schema: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string', description: 'Deployment ID' },
      },
      required: ['deployment_id'],
    },
    async execute(args: { deployment_id: string }) {
      const events = await vercel.getDeploymentEvents(args.deployment_id);
      const logs = events
        .filter((e: any) => e.type === 'stdout' || e.type === 'stderr')
        .slice(-30)
        .map((e: any) => `[${e.type}] ${e.payload?.text || e.text || ''}`)
        .join('\n');
      return { success: true, data: logs || 'No log output found.' };
    },
  },
  {
    name: 'vercel_redeploy',
    description: 'Trigger a redeployment of an existing Vercel deployment',
    input_schema: {
      type: 'object',
      properties: {
        deployment_id: { type: 'string', description: 'Deployment ID to redeploy' },
      },
      required: ['deployment_id'],
    },
    async execute(args: { deployment_id: string }) {
      const result = await vercel.triggerRedeploy(args.deployment_id);
      return {
        success: true,
        data: { id: result.id, url: result.url ? `https://${result.url}` : null },
      };
    },
  },
];
