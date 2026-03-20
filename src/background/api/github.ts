import { GITHUB_API_URL } from '@/shared/constants';
import { getSettings } from '@/shared/storage';

async function githubFetch(path: string, options: RequestInit = {}): Promise<any> {
  const settings = await getSettings();
  if (!settings.githubToken) throw new Error('GitHub token not configured');

  const res = await fetch(`${GITHUB_API_URL}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${settings.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.json();
}

export async function listRepos(perPage = 10): Promise<any[]> {
  return githubFetch(`/user/repos?sort=updated&per_page=${perPage}`);
}

export async function getRepo(owner: string, repo: string): Promise<any> {
  return githubFetch(`/repos/${owner}/${repo}`);
}

export async function listIssues(owner: string, repo: string, state = 'open'): Promise<any[]> {
  return githubFetch(`/repos/${owner}/${repo}/issues?state=${state}&per_page=10`);
}

export async function listUserIssues(state = 'open'): Promise<any[]> {
  return githubFetch(`/user/issues?state=${state}&per_page=15&filter=created`);
}

export async function createIssue(owner: string, repo: string, title: string, body: string, labels?: string[]): Promise<any> {
  return githubFetch(`/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function listPullRequests(owner: string, repo: string, state = 'open'): Promise<any[]> {
  return githubFetch(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=10`);
}

export async function createPullRequest(owner: string, repo: string, title: string, body: string, head: string, base: string): Promise<any> {
  return githubFetch(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head, base }),
  });
}

export async function searchCode(query: string): Promise<any> {
  return githubFetch(`/search/code?q=${encodeURIComponent(query)}&per_page=10`);
}

export async function getUser(): Promise<any> {
  return githubFetch('/user');
}
