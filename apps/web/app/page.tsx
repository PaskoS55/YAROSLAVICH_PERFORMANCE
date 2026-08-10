'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="page-content">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">YAROSLAVICH PERFORMANCE</h1>
        <p className="text-gray-600 mb-8">
          Платформа для мониторинга физического тестирования волейболистов
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/players" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2">Игроки</h3>
            <p className="text-gray-600 text-sm">Управление базой игроков</p>
          </Link>
          
          <Link href="/sessions" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2">Тестирования</h3>
            <p className="text-gray-600 text-sm">Ввод и просмотр результатов</p>
          </Link>
          
          <Link href="/testing/team" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2">Командный ввод</h3>
            <p className="text-gray-600 text-sm">Массовый ввод данных</p>
          </Link>
          
          <Link href="/analytics/trends" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2">Динамика</h3>
            <p className="text-gray-600 text-sm">Графики и тренды</p>
          </Link>
          
          <Link href="/analytics/compare" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2">Сравнение</h3>
            <p className="text-gray-600 text-sm">Сравнение игроков</p>
          </Link>
          
          <Link href="/team" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-2">Команда</h3>
            <p className="text-gray-600 text-sm">Обзор команды</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
