import { VERCEL_API_URL } from '@/shared/constants';
import { getSettings } from '@/shared/storage';

async function vercelFetch(path: string, options: RequestInit = {}): Promise<any> {
  const settings = await getSettings();
  if (!settings.vercelToken) throw new Error('Vercel token not configured');

  const res = await fetch(`${VERCEL_API_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${settings.vercelToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Vercel API ${res.status}: ${err}`);
  }
  return res.json();
}

export async function listProjects(limit = 10): Promise<any> {
  return vercelFetch(`/v9/projects?limit=${limit}`);
}

export async function getProject(idOrName: string): Promise<any> {
  return vercelFetch(`/v9/projects/${encodeURIComponent(idOrName)}`);
}

export async function listDeployments(projectId?: string, limit = 10): Promise<any> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (projectId) params.set('projectId', projectId);
  return vercelFetch(`/v6/deployments?${params}`);
}

export async function getDeployment(id: string): Promise<any> {
  return vercelFetch(`/v13/deployments/${id}`);
}

export async function getDeploymentEvents(id: string): Promise<any[]> {
  return vercelFetch(`/v3/deployments/${id}/events`);
}

export async function triggerRedeploy(deploymentId: string): Promise<any> {
  return vercelFetch(`/v13/deployments`, {
    method: 'POST',
    body: JSON.stringify({ deploymentId, target: 'production' }),
  });
}

export async function listDomains(projectId: string): Promise<any> {
  return vercelFetch(`/v9/projects/${projectId}/domains`);
}
