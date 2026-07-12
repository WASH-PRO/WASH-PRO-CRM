import clsx from 'clsx';

type BrandLogoSize = 'sm' | 'md' | 'lg';
type BrandLogoTone = 'default' | 'onDark' | 'onLight';

const sizeClass: Record<BrandLogoSize, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-11 w-11 rounded-xl',
};

const toneClass: Record<BrandLogoTone, string> = {
  default:
    'border-brand-500/45 text-brand-600 ring-1 ring-brand-500/15 dark:border-brand-400/50 dark:text-brand-400 dark:ring-brand-400/20',
  onDark: 'border-cyan-300/55 text-cyan-200 ring-1 ring-cyan-300/25',
  onLight:
    'border-brand-500/40 text-brand-600 ring-1 ring-brand-500/10 dark:border-brand-400/45 dark:text-brand-400 dark:ring-brand-400/15',
};

function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M16 5.5c2.2 0 4 1.8 4 4 0 2.6-2.1 4.8-4.7 7.1-1.1.9-2.1 1.8-2.9 2.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M16 5.5c-2.2 0-4 1.8-4 4 0 2.6 2.1 4.8 4.7 7.1 1.1.9 2.1 1.8 2.9 2.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M7.5 23.5 11.5 13.5 16 20.5 20.5 13.5 24.5 23.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="25.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({
  size = 'md',
  tone = 'default',
  className,
  imageUrl,
}: {
  size?: BrandLogoSize;
  tone?: BrandLogoTone;
  className?: string;
  imageUrl?: string;
}) {
  const iconScale = size === 'sm' ? 'h-[58%] w-[58%]' : 'h-[56%] w-[56%]';

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={clsx('shrink-0 object-contain', sizeClass[size], className)}
      />
    );
  }

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center border-2 bg-transparent',
        sizeClass[size],
        toneClass[tone],
        className
      )}
    >
      <LogoMark className={iconScale} />
    </div>
  );
}
