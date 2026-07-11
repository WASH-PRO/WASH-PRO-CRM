import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isNewerVersion } from './semver.js';

const execFileAsync = promisify(execFile);

export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  prerelease: boolean;
  published_at: string;
}

function isRateLimitError(status: number, remaining: string | null): boolean {
  return (status === 403 || status === 429) && remaining === '0';
}

async function fetchLatestReleaseViaGit(repo: string): Promise<GitHubRelease | null> {
  const url = `https://github.com/${repo}.git`;
  const { stdout } = await execFileAsync('git', ['ls-remote', '--tags', url], {
    timeout: 60_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });

  const tags = new Set<string>();
  for (const line of stdout.split('\n')) {
    const match = line.match(/refs\/tags\/(v[\d.]+)$/);
    if (match?.[1]) tags.add(match[1]);
  }
  if (!tags.size) return null;

  let bestTag = '';
  for (const tag of tags) {
    if (!bestTag || isNewerVersion(parseTagVersion(tag), parseTagVersion(bestTag))) {
      bestTag = tag;
    }
  }
  if (!bestTag) return null;

  return {
    tag_name: bestTag,
    name: bestTag,
    html_url: `https://github.com/${repo}/releases/tag/${bestTag}`,
    body: '',
    prerelease: false,
    published_at: '',
  };
}

export async function fetchLatestRelease(repo: string, includePrerelease = false): Promise<GitHubRelease | null> {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=15`;
  const token = process.env.GITHUB_TOKEN || process.env.UPDATE_GITHUB_TOKEN || '';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'WASH-PRO-CRM-Updater',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (isRateLimitError(res.status, remaining)) {
        return fetchLatestReleaseViaGit(repo);
      }
      throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
    }
    const releases = (await res.json()) as GitHubRelease[];
    const stable = releases.filter((r) => includePrerelease || !r.prerelease);
    if (!stable.length) return null;

    return stable.reduce((best, release) => {
      const bestVer = best.tag_name.replace(/^v/i, '');
      const nextVer = release.tag_name.replace(/^v/i, '');
      return isNewerVersion(nextVer, bestVer) ? release : best;
    });
  } catch (err) {
    if (err instanceof Error && !token) {
      try {
        return await fetchLatestReleaseViaGit(repo);
      } catch {
        // fall through to original error
      }
    }
    throw err;
  }
}

export function parseTagVersion(tag: string): string {
  return tag.replace(/^v/i, '');
}
