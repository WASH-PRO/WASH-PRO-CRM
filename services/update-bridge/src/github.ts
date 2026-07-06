import { isNewerVersion } from './semver.js';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  prerelease: boolean;
  published_at: string;
}

export async function fetchLatestRelease(repo: string, includePrerelease = false): Promise<GitHubRelease | null> {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=15`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'WASH-PRO-CRM-Updater',
    },
  });
  if (!res.ok) {
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
}

export function parseTagVersion(tag: string): string {
  return tag.replace(/^v/i, '');
}
