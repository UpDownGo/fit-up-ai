import React from 'react';
import { HistoryItem } from '../types';
import { useLocalization } from '../context/LocalizationContext';

interface HistoryProps {
  history: HistoryItem[];
  onClearHistory: () => void;
}

export const History: React.FC<HistoryProps> = ({ history, onClearHistory }) => {
  const { t } = useLocalization();

  if (history.length === 0) {
    return null;
  }

  return (
    <section className="w-full mt-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-300">{t('historyTitle')}</h2>
        <button 
          onClick={onClearHistory} 
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold text-sm transition-colors duration-300"
        >
          {t('clearHistoryButton')}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {history.map(item => (
          <div key={item.id} className="group relative aspect-square">
            <img src={item.generatedImage} alt="Generated try-on" className="w-full h-full object-cover rounded-lg shadow-md" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg">
               <a href={item.generatedImage} download={`virtual-try-on-${item.id}.png`} className="text-white text-sm bg-indigo-600 px-3 py-1 rounded">{t('downloadButton')}</a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
