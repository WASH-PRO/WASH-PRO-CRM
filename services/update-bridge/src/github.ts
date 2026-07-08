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
  const token = process.env.GITHUB_TOKEN || process.env.UPDATE_GITHUB_TOKEN || '';
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'WASH-PRO-CRM-Updater',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    // Неавторизованный лимит GitHub — 60 запросов/час на IP; при исчерпании
    // возвращается 403 с remaining=0. Даём понятное сообщение вместо «нет релизов».
    const remaining = res.headers.get('x-ratelimit-remaining');
    if ((res.status === 403 || res.status === 429) && remaining === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : 'позже';
      throw new Error(
        token
          ? `Превышен лимит GitHub API, повтор после ${resetAt}`
          : `Превышен лимит GitHub API (60/час без токена). Задайте GITHUB_TOKEN. Сброс: ${resetAt}`
      );
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
}

export function parseTagVersion(tag: string): string {
  return tag.replace(/^v/i, '');
}
