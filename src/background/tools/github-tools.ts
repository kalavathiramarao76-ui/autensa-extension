import { Tool } from '@/shared/types';
import * as github from '../api/github';

export const githubTools: Tool[] = [
  {
    name: 'github_list_repos',
    description: 'List the authenticated user\'s recent GitHub repositories',
    input_schema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of repos to return (max 30)', default: 10 },
      },
    },
    async execute(args: { per_page?: number }) {
      const repos = await github.listRepos(args.per_page || 10);
      return {
        success: true,
        data: repos.map((r: any) => ({
          name: r.full_name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          updated: r.updated_at,
          url: r.html_url,
          private: r.private,
        })),
      };
    },
  },
  {
    name: 'github_list_issues',
    description: 'List issues for a GitHub repository, or list all issues assigned to the authenticated user',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (optional — omit for user\'s own issues)' },
        repo: { type: 'string', description: 'Repository name (optional)' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
      },
    },
    async execute(args: { owner?: string; repo?: string; state?: string }) {
      let issues;
      if (args.owner && args.repo) {
        issues = await github.listIssues(args.owner, args.repo, args.state);
      } else {
        issues = await github.listUserIssues(args.state);
      }
      return {
        success: true,
        data: issues.map((i: any) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          labels: i.labels?.map((l: any) => l.name),
          created: i.created_at,
          url: i.html_url,
          repo: i.repository?.full_name,
        })),
      };
    },
  },
  {
    name: 'github_create_issue',
    description: 'Create a new GitHub issue in a repository',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body (markdown)' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to apply' },
      },
      required: ['owner', 'repo', 'title', 'body'],
    },
    async execute(args: { owner: string; repo: string; title: string; body: string; labels?: string[] }) {
      const issue = await github.createIssue(args.owner, args.repo, args.title, args.body, args.labels);
      return {
        success: true,
        data: { number: issue.number, url: issue.html_url, title: issue.title },
      };
    },
  },
  {
    name: 'github_list_pull_requests',
    description: 'List pull requests for a GitHub repository',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
      },
      required: ['owner', 'repo'],
    },
    async execute(args: { owner: string; repo: string; state?: string }) {
      const prs = await github.listPullRequests(args.owner, args.repo, args.state);
      return {
        success: true,
        data: prs.map((pr: any) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          author: pr.user?.login,
          created: pr.created_at,
          url: pr.html_url,
          draft: pr.draft,
          mergeable: pr.mergeable,
        })),
      };
    },
  },
  {
    name: 'github_search_code',
    description: 'Search for code across GitHub repositories',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (can include qualifiers like repo:, language:, etc.)' },
      },
      required: ['query'],
    },
    async execute(args: { query: string }) {
      const results = await github.searchCode(args.query);
      return {
        success: true,
        data: results.items?.map((item: any) => ({
          name: item.name,
          path: item.path,
          repo: item.repository?.full_name,
          url: item.html_url,
        })),
      };
    },
  },
];
