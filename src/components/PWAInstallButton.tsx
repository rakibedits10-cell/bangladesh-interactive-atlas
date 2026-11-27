import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { Lang } from '../types/map';

interface PWAInstallButtonProps {
  lang: Lang;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/pwa-192x192.png"
                    alt=""
                    className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white shrink-0"
                  />
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'iPhone / iPad-এ ইনস্টল করুন'
                      : 'Install on iPhone / iPad'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  {lang === 'bn' ? (
                    <>
                      Safari টুলবারে{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                        Share <Share className="w-3 h-3" />
                      </span>{' '}
                      বাটনে ট্যাপ করুন।
                    </>
                  ) : (
                    <>
                      Tap the{' '}
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                        Share <Share className="w-3 h-3" />
                      </span>{' '}
                      button in Safari toolbar.
                    </>
                  )}
                </li>
                <li>
                  {lang === 'bn' ? (
                    <>
                      নিচে স্ক্রল করে{' '}
                      <strong className="text-slate-900 dark:text-white">
                        Add to Home Screen
                      </strong>{' '}
                      নির্বাচন করুন।
                    </>
                  ) : (
                    <>
                      Scroll down and tap{' '}
                      <strong className="text-slate-900 dark:text-white">
                        Add to Home Screen
                      </strong>
                      .
                    </>
                  )}
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
