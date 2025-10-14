import React, { useState, useEffect } from 'react';
import { useLocalization } from '../context/LocalizationContext';
import { AppSettings } from '../types';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  currentSettings: AppSettings;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
  const { t } = useLocalization();
  const [localSettings, setLocalSettings] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    setLocalSettings(currentSettings);
  }, [currentSettings]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };
  
  const handleModelChange = (type: keyof AppSettings, value: string) => {
    setLocalSettings(prev => ({ ...prev, [type]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700">
          <h2 id="settings-title" className="text-2xl font-bold text-white">{t('settingsTitle')}</h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label htmlFor="detection-model" className="block text-sm font-medium text-gray-300 mb-2">
              {t('detectionModelLabel')}
            </label>
            <select
              id="detection-model"
              value={localSettings.detectionModel}
              onChange={(e) => handleModelChange('detectionModel', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
            </select>
          </div>
          <div>
            <label htmlFor="generation-model" className="block text-sm font-medium text-gray-300 mb-2">
              {t('generationModelLabel')}
            </label>
            <select
              id="generation-model"
              value={localSettings.generationModel}
              onChange={(e) => handleModelChange('generationModel', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="gemini-2.5-flash-image">gemini-2.5-flash-image</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold text-sm transition-colors duration-300">
            {t('closeButton')}
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold text-sm transition-colors duration-300">
            {t('saveSettingsButton')}
          </button>
        </div>
      </div>
    </div>
  );
};