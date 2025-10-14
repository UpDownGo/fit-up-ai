import React, { useState, useEffect, useCallback } from 'react';
import { AppState, BoundingBox, DetectedPerson, HistoryItem, AppSettings } from './types';
import { useLocalization } from './context/LocalizationContext';
import { detectPeopleInImage, generateVirtualTryOnImage, isApiKeyAvailable } from './services/geminiService';
import { blobToBase64, urlToBase64 } from './utils/fileUtils';
import { checkImageQuality } from './utils/imageQuality';

import { ImageUploader } from './components/ImageUploader';
import { PersonSelector } from './components/PersonSelector';
import { ImageEditor } from './components/ImageEditor';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { saveData, loadData, clearDB } from './utils/db';


const SESSION_STATE_KEY = 'virtualTryOnState';
const SETTINGS_KEY = 'appSettings';
const HISTORY_KEY = 'generationHistory';


const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center text-center p-8">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg text-gray-300">{message}</p>
    </div>
);

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.IDLE);
    const [targetImage, setTargetImage] = useState<string | null>(null);
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [detectedPeople, setDetectedPeople] = useState<DetectedPerson[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<DetectedPerson | null>(null);
    const [sourceGarmentBox, setSourceGarmentBox] = useState<BoundingBox | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);
    const [isPasting, setIsPasting] = useState(false);
    const [showRestoreNotification, setShowRestoreNotification] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isApiKeySet, setIsApiKeySet] = useState(false);
    const [settings, setSettings] = useState<AppSettings>({
      detectionModel: 'gemini-2.5-flash',
      generationModel: 'gemini-2.5-flash-image',
    });
    
    const { t, language, setLanguage } = useLocalization();
    
    useEffect(() => {
        setIsApiKeySet(isApiKeyAvailable());

        const loadInitialData = async () => {
            const savedState = await loadData<any>(SESSION_STATE_KEY);
            const savedHistory = await loadData<HistoryItem[]>(HISTORY_KEY);
            let savedSettings = await loadData<AppSettings>(SETTINGS_KEY);

            if (savedHistory) {
                setHistory(savedHistory);
            }
            if (savedSettings) {
                // Auto-correct deprecated model names from old saved settings
                if (savedSettings.generationModel === 'gemini-2.5-flash-preview-image') {
                    savedSettings.generationModel = 'gemini-2.5-flash-image';
                }
                setSettings(savedSettings);
            }

            if (savedState && savedState.appState) {
                 try {
                    setAppState(savedState.appState);
                    setTargetImage(savedState.targetImage || null);
                    setSourceImage(savedState.sourceImage || null);
                    setDetectedPeople(savedState.detectedPeople || []);
                    setSelectedPerson(savedState.selectedPerson || null);
                    setSourceGarmentBox(savedState.sourceGarmentBox || null);
                    setLanguage(savedState.language || 'ko');
                    setShowRestoreNotification(true);
                } catch (e) {
                    console.error("Failed to parse saved state", e);
                    await clearDB();
                }
            }
        };
        loadInitialData();
    }, [setLanguage]);

    useEffect(() => {
        const savableStates = [
            AppState.TARGET_PERSON_CHOOSING,
            AppState.TARGET_PERSON_SELECTED,
            AppState.SOURCE_TYPE_CHOSEN,
            AppState.SOURCE_IMAGE_UPLOADED,
            AppState.GARMENT_SELECTED,
        ];

        const stateToSave = {
            appState, targetImage, sourceImage,
            detectedPeople, selectedPerson, sourceGarmentBox, language,
        };

        if (savableStates.includes(appState)) {
           saveData(SESSION_STATE_KEY, stateToSave).catch(e => console.error("Failed to save session state", e));
        }
    }, [appState, targetImage, sourceImage, detectedPeople, selectedPerson, sourceGarmentBox, language]);

    const handleReset = useCallback(async () => {
        setAppState(AppState.IDLE);
        setTargetImage(null);
        setSourceImage(null);
        setDetectedPeople([]);
        setSelectedPerson(null);
        setSourceGarmentBox(null);
        setGeneratedImage(null);
        setError(null);
        setLoadingMessage('');
        setImageUrl('');
        await clearDB();
    }, []);

    const handleImageFile = async (file: File, imageSetter: (b64: string) => void, nextState: AppState) => {
        if (file.size > 5 * 1024 * 1024) {
            setError(t('fileTooLargeError', { size: 5 }));
            setAppState(AppState.ERROR);
            return;
        }

        setLoadingMessage(t('analyzingImageQuality'));
        setAppState(AppState.GENERATING);
        setError(null);

        try {
            const base64 = await blobToBase64(file);
            const qualityResult = await checkImageQuality(base64);
            if (!qualityResult.isOk) {
                const issues = qualityResult.issues.map(issue => t(`qualityError${issue.charAt(0).toUpperCase() + issue.slice(1).replace('-', '')}`)).join(', ');
                throw new Error(`${t('imageQualityError')}: ${issues}. ${t('qualityErrorSuggestion')}`);
            }
            imageSetter(base64);
            setAppState(nextState);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : t('imageProcessingError');
            setError(errorMessage);
            setAppState(AppState.ERROR);
        } finally {
            setLoadingMessage('');
        }
    };
    
    const processProvidedImage = async (base64Provider: () => Promise<string>) => {
        setLoadingMessage(t('analyzingImageQuality'));
        setAppState(AppState.GENERATING);
        setError(null);
        try {
            const base64 = await base64Provider();
            const qualityResult = await checkImageQuality(base64);
            if (!qualityResult.isOk) {
                const issues = qualityResult.issues.map(issue => t(`qualityError${issue.charAt(0).toUpperCase() + issue.slice(1).replace('-', '')}`)).join(', ');
                throw new Error(`${t('imageQualityError')}: ${issues}. ${t('qualityErrorSuggestion')}`);
            }
            setSourceImage(base64);
            setAppState(AppState.SOURCE_IMAGE_UPLOADED);
        } catch (err) {
            let errorMessage = err instanceof Error ? err.message : t('imageProcessingError');
            if (errorMessage === 'FILE_TOO_LARGE') {
                errorMessage = t('fileTooLargeError', { size: 5 });
            }
            setError(errorMessage);
            setAppState(AppState.ERROR);
        } finally {
            setLoadingMessage('');
        }
    };

    const handleTargetImageUpload = (file: File) => {
        handleImageFile(file, setTargetImage, AppState.ANALYZING_TARGET_IMAGE);
    };

    const handleSourceImageUpload = (file: File) => {
        handleImageFile(file, setSourceImage, AppState.SOURCE_IMAGE_UPLOADED);
    };

    const handleUrlSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageUrl || isFetchingUrl) return;
        setIsFetchingUrl(true);
        await processProvidedImage(() => urlToBase64(imageUrl, 5 * 1024 * 1024));
        setIsFetchingUrl(false);
    };

    const handlePasteFromClipboard = async () => {
        if (!navigator.clipboard?.read) {
            setError(t('clipboardApiNotSupportedError'));
            setAppState(AppState.ERROR);
            return;
        }
        setIsPasting(true);
        setError(null);
        try {
            const items = await navigator.clipboard.read();
            const imageItem = items.find(item => item.types.some(type => type.startsWith('image/')));
            if (!imageItem) {
                throw new Error(t('clipboardEmptyError'));
            }
            const blob = await imageItem.getType(imageItem.types.find(type => type.startsWith('image/'))!);
             if (blob.size > 5 * 1024 * 1024) {
                throw new Error(t('fileTooLargeError', { size: 5 }));
            }
            await processProvidedImage(() => blobToBase64(blob));
        } catch (err) {
            const message = err instanceof Error ? err.message : t('imageUploadFailed');
            setError(message.includes('NotAllowedError') ? t('clipboardPermissionError') : message);
            setAppState(AppState.ERROR);
        } finally {
            setIsPasting(false);
        }
    };

    const handlePersonSelected = (person: DetectedPerson) => {
        setSelectedPerson(person);
        setAppState(AppState.TARGET_PERSON_SELECTED);
    };

    const handleSourceTypeSelection = (useSameImage: boolean) => {
        if (useSameImage) {
            setSourceImage(targetImage);
            setAppState(AppState.SOURCE_IMAGE_UPLOADED);
        } else {
            setAppState(AppState.SOURCE_TYPE_CHOSEN);
        }
    };

    const handleGarmentBoxDrawn = (box: BoundingBox) => {
        setSourceGarmentBox(box);
        setAppState(AppState.GARMENT_SELECTED);
    };

    const handleGenerateClick = () => {
        if (targetImage && selectedPerson && sourceImage && sourceGarmentBox) {
            setAppState(AppState.GENERATING);
        }
    };
    
    useEffect(() => {
        const analyzeTargetImage = async () => {
            if (appState === AppState.ANALYZING_TARGET_IMAGE && targetImage) {
                setLoadingMessage(t('detectingPeople'));
                try {
                    const people = await detectPeopleInImage(targetImage, settings.detectionModel);
                    if (people.length > 0) {
                        setDetectedPeople(people);
                        setAppState(AppState.TARGET_PERSON_CHOOSING);
                    } else {
                        setError(t('noPeopleDetectedError'));
                        setAppState(AppState.ERROR);
                    }
                } catch (err) {
                    setError(t('detectionFailedError') + (err instanceof Error ? `: ${err.message}`: ''));
                    setAppState(AppState.ERROR);
                } finally {
                    setLoadingMessage('');
                }
            }
        };
        analyzeTargetImage();
    }, [appState, targetImage, t, settings.detectionModel]);

    useEffect(() => {
        const performVirtualTryOn = async () => {
            if (appState === AppState.GENERATING && targetImage && selectedPerson && sourceImage && sourceGarmentBox) {
                setLoadingMessage(t('generatingImage'));
                setGeneratedImage(null);
                setError(null);
                try {
                    const resultImage = await generateVirtualTryOnImage(
                        targetImage,
                        selectedPerson.box,
                        sourceImage,
                        sourceGarmentBox,
                        language,
                        settings.generationModel
                    );
                    setGeneratedImage(resultImage);
                    const newHistoryItem: HistoryItem = { id: new Date().toISOString(), generatedImage: resultImage };
                    const updatedHistory = [newHistoryItem, ...history];
                    setHistory(updatedHistory);
                    await saveData(HISTORY_KEY, updatedHistory);
                    setAppState(AppState.RESULT_READY);
                } catch (err) {
                    const detailedError = err instanceof Error ? err.message : String(err);
                    console.error("Virtual try-on failed:", err);
                    const finalErrorMessage = `${t('generationFailedError')} [${detailedError}]`;
                    setError(finalErrorMessage);
                    setAppState(AppState.ERROR);
                } finally {
                    setLoadingMessage('');
                }
            }
        };
        performVirtualTryOn();
    }, [appState, targetImage, selectedPerson, sourceImage, sourceGarmentBox, language, t, settings.generationModel, history]);

    const handleClearHistory = async () => {
        setHistory([]);
        await saveData(HISTORY_KEY, []);
    };
    
    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'ko' : 'en');
    };

    const handleSaveSettings = async (newSettings: AppSettings) => {
        setSettings(newSettings);
        await saveData(SETTINGS_KEY, newSettings);
    }

    const renderContent = () => {
        if (appState === AppState.GENERATING || loadingMessage) {
            return <LoadingSpinner message={loadingMessage || t('generatingImage')} />;
        }

        switch (appState) {
            case AppState.IDLE:
                return <ImageUploader onImageUpload={handleTargetImageUpload} title={t('step1Title')} description={t('step1Description')} />;

            case AppState.TARGET_PERSON_CHOOSING:
                if (!targetImage) return null;
                return <PersonSelector imageSrc={targetImage} people={detectedPeople} onPersonSelected={handlePersonSelected} />;
            
            case AppState.TARGET_PERSON_SELECTED:
                return (
                    <div className="flex flex-col items-center gap-4">
                        <h2 className="text-2xl font-bold text-center text-indigo-300">{t('step3Title')}</h2>
                        <p className="text-gray-400 text-center">{t('step3Description')}</p>
                        <div className="flex gap-4 mt-4">
                            <button onClick={() => handleSourceTypeSelection(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors duration-300">{t('useSameImageButton')}</button>
                            <button onClick={() => handleSourceTypeSelection(false)} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-semibold transition-colors duration-300">{t('uploadNewImageButton')}</button>
                        </div>
                    </div>
                );

            case AppState.SOURCE_TYPE_CHOSEN:
                return (
                    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
                        <ImageUploader onImageUpload={handleSourceImageUpload} title={t('step4Title')} description={t('step4Description')} />
                        
                        <div className="flex items-center w-full">
                            <hr className="flex-grow border-gray-600" />
                            <span className="px-4 text-gray-400 font-semibold">{t('orDivider')}</span>
                            <hr className="flex-grow border-gray-600" />
                        </div>
    
                        <button 
                            onClick={handlePasteFromClipboard} 
                            disabled={isPasting} 
                            className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-semibold transition-colors duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                            {isPasting ? t('pastingFromClipboardButton') : t('pasteFromClipboardButton')}
                        </button>
    
                        <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input
                                    id="url-input"
                                    type="url"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder={t('urlInputPlaceholder')}
                                    className="flex-grow bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                <button type="submit" disabled={isFetchingUrl || !imageUrl} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors duration-300 disabled:opacity-50">
                                    {isFetchingUrl ? t('fetchingUrlButton') : t('useUrlButton')}
                                </button>
                            </div>
                        </form>
                    </div>
                );

            case AppState.SOURCE_IMAGE_UPLOADED:
            case AppState.GARMENT_SELECTED:
                 if (!sourceImage) return null;
                 const isSameImage = targetImage === sourceImage;
                 return (
                    <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
                        <ImageEditor 
                            imageSrc={sourceImage} 
                            onBoxDrawn={handleGarmentBoxDrawn} 
                            boxColor="rgba(34, 197, 94, 0.9)" 
                            instruction={t('step5Instruction')} 
                            existingBox={isSameImage ? selectedPerson?.box : null}
                            garmentBox={sourceGarmentBox}
                        />
                        {appState === AppState.GARMENT_SELECTED && (
                             <button 
                                onClick={handleGenerateClick}
                                className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold text-lg transition-colors duration-300 shadow-lg animate-pulse"
                            >
                                {t('generateButton')}
                            </button>
                        )}
                    </div>
                );
            
            case AppState.RESULT_READY:
                if (!generatedImage) return null;
                return (
                    <div className="flex flex-col items-center gap-6">
                        <h2 className="text-3xl font-bold text-center text-green-400">{t('resultTitle')}</h2>
                        <img src={generatedImage} alt="Virtual try-on result" className="rounded-lg shadow-2xl max-w-full lg:max-w-2xl" />
                         <a href={generatedImage} download={`virtual-try-on-${new Date().toISOString()}.png`} className="inline-block mt-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors duration-300">{t('downloadButton')}</a>
                    </div>
                );
            
            case AppState.ERROR:
                return (
                    <div className="flex flex-col items-center gap-4 text-center bg-red-900/50 border border-red-700 p-8 rounded-lg">
                        <h2 className="text-2xl font-bold text-red-400">{t('errorTitle')}</h2>
                        <p className="text-red-300 max-w-md">{error}</p>
                        <button onClick={handleReset} className="mt-4 px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition-colors duration-300">{t('startOverButton')}</button>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            {showRestoreNotification && (
                <div className="bg-indigo-600 text-center py-2 px-4 relative">
                    <p className="text-sm font-semibold">{t('sessionRestoredNotification')}</p>
                    <button 
                        onClick={() => setShowRestoreNotification(false)} 
                        className="absolute top-1/2 right-4 -translate-y-1/2 text-white hover:bg-indigo-500 rounded-full p-1"
                        aria-label={t('closeButton')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}
            <header className="py-6 px-4 md:px-8 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">{t('appTitle')}</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={toggleLanguage} className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">
                            {language === 'en' ? '한국어' : 'English'}
                        </button>
                         <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors" aria-label={t('settingsTitle')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106A1.532 1.532 0 0111.49 3.17zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                        </button>
                        {appState !== AppState.IDLE && (
                            <button onClick={handleReset} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold text-sm transition-colors duration-300">
                                {t('startOverButton')}
                            </button>
                        )}
                    </div>
                </div>
            </header>
            
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={handleSaveSettings} currentSettings={settings} />

            <main className="py-12 px-4 md:px-8">
                <div className="max-w-7xl mx-auto flex flex-col items-center">
                    {renderContent()}
                </div>
            </main>

            {history.length > 0 && (
                 <div className="py-12 px-4 md:px-8 bg-gray-900/50">
                    <div className="max-w-7xl mx-auto">
                        <History history={history} onClearHistory={handleClearHistory} />
                    </div>
                 </div>
            )}
            
            <footer className="text-center py-6 text-gray-500 text-sm border-t border-gray-800">
                 <div className="flex justify-center items-center gap-4">
                    <p>{t('footerText')}</p>
                    <div className="flex items-center gap-2" title={isApiKeySet ? t('apiKeyConnected') : t('apiKeyMissing')}>
                        <span className={`h-2.5 w-2.5 rounded-full ${isApiKeySet ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span>{isApiKeySet ? t('apiKeyConnected') : t('apiKeyMissing')}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default App;