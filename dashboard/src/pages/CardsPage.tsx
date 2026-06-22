import { useEffect, useState } from 'react';
import { apiList } from '../api/client';
import { PageHeader, Table, Loading, Badge } from '../components/UI';
import type { Card } from '../types';

const typeLabel: Record<string, string> = {
  regular: 'Обычная',
  unlimited: 'Безлимитная',
  service: 'Сервисная',
};

export function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiList<Card>('/crm/cards').then(setCards).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Карты клиентов" subtitle="Баланс, скидки и статус карт" />
      <Table>
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">Номер карты</th>
            <th className="px-4 py-3">Тип</th>
            <th className="px-4 py-3">Баланс</th>
            <th className="px-4 py-3">Скидка</th>
            <th className="px-4 py-3">Статус</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3 font-mono">{c.cardNumber}</td>
              <td className="px-4 py-3">{typeLabel[c.cardType] || c.cardType}</td>
              <td className="px-4 py-3">{c.balance?.toFixed(2)} ₽</td>
              <td className="px-4 py-3">{c.discount}%</td>
              <td className="px-4 py-3">
                <Badge variant={c.status === 'active' ? 'success' : 'warning'}>{c.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
