import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useLocale } from '../i18n/LocaleContext';

export interface TabNavItem {
  to: string;
  label: string;
}

interface TabNavProps {
  items: TabNavItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClass: Record<NonNullable<TabNavProps['columns']>, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function TabNav({ items, columns = 3, className }: TabNavProps) {
  const { t } = useLocale();
  return (
    <nav className={clsx('tab-bar', columnClass[columns], className)} aria-label={t('tabNav.ariaLabel')}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => clsx('tab-item', isActive && 'tab-item-active')}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
