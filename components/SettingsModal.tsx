'use client';

import React, { useState } from 'react';
import { X, User, Palette, Globe, Database, Loader2, Check, AlertTriangle } from 'lucide-react';
import { TranslationDictionary, InterfaceLanguage } from '@/lib/i18n';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string | null;
    email: string;
    defaultLanguage: string;
    interfaceLanguage: string;
    theme: string;
    fontSize: string;
  };
  onUpdateUser: (updatedUser: any) => void;
  onExportAllJson: () => void;
  onDeleteAllChats: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  t: TranslationDictionary;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onExportAllJson,
  onDeleteAllChats,
  onDeleteAccount,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'language' | 'data'>('profile');
  const [name, setName] = useState(user.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [theme, setTheme] = useState(user.theme || 'system');
  const [fontSize, setFontSize] = useState(user.fontSize || 'medium');
  const [defaultLanguage, setDefaultLanguage] = useState(user.defaultLanguage || 'auto');
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(
    (user.interfaceLanguage as InterfaceLanguage) || 'en'
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSavePreferences = async (overrides: Record<string, any> = {}) => {
    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const payload = {
        name,
        theme,
        fontSize,
        defaultLanguage,
        interfaceLanguage,
        ...(currentPassword && newPassword ? { currentPassword, newPassword } : {}),
        ...overrides,
      };

      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      onUpdateUser(data.user);
      setSaveSuccess(true);
      setCurrentPassword('');
      setNewPassword('');

      // Apply theme and font size immediately to document
      if (payload.theme) {
        const isDark =
          payload.theme === 'dark' ||
          (payload.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', isDark);
      }
      if (payload.fontSize) {
        document.body.setAttribute('data-font-size', payload.fontSize);
      }

      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.settings}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Tabs on left, Content on right */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Navigation tabs */}
          <div className="w-full sm:w-48 p-3 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'profile'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>{t.profile}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'appearance'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Palette className="w-3.5 h-3.5 shrink-0" />
              <span>{t.appearance}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('language')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'language'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{t.languageTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'data'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>{t.dataTab}</span>
            </button>
          </div>

          {/* Active Tab Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Preferences saved successfully!</span>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.name}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t.email}
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    {t.changePassword}
                  </h4>
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="password"
                      placeholder="New Password (min 8 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t.theme}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['system', 'light', 'dark'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setTheme(mode);
                          handleSavePreferences({ theme: mode });
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                          theme === mode
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {mode === 'system' ? t.themeSystem : mode === 'light' ? t.themeLight : t.themeDark}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {t.fontSize}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setFontSize(size);
                          handleSavePreferences({ fontSize: size });
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                          fontSize === size
                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {size === 'small' ? t.fontSmall : size === 'medium' ? t.fontNormal : t.fontLarge}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Language Tab */}
            {activeTab === 'language' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.interfaceLang}
                  </label>
                  <select
                    value={interfaceLanguage}
                    onChange={(e) => {
                      const newLang = e.target.value as InterfaceLanguage;
                      setInterfaceLanguage(newLang);
                      handleSavePreferences({ interfaceLanguage: newLang });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="en">English (English)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="te">తెలుగు (Telugu)</option>
                    <option value="ml">മലയാളം (Malayalam)</option>
                    <option value="kn">ಕನ್ನಡ (Kannada)</option>
                    <option value="bn">বাংলা (Bengali)</option>
                    <option value="mr">मराठी (Marathi)</option>
                    <option value="gu">ગુજરાતી (Gujarati)</option>
                    <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                    <option value="or">ଓଡ଼ିଆ (Odia)</option>
                    <option value="ur">اردو (Urdu)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    {t.defaultReplyLang}
                  </label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => {
                      const newReply = e.target.value;
                      setDefaultLanguage(newReply);
                      handleSavePreferences({ defaultLanguage: newReply });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="auto">Auto-detect user language (Recommended)</option>
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName} ({l.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-1">
                    Export Chat History
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                    Download all your conversations, citations, and message metadata in JSON format.
                  </p>
                  <button
                    type="button"
                    onClick={onExportAllJson}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                  >
                    {t.exportJson}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-1">
                    {t.deleteAllChats}
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mb-2.5">
                    Permanently delete all your chat conversations and message history.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t.confirmDelete)) {
                        onDeleteAllChats();
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
                  >
                    {t.deleteAllChats}
                  </button>
                </div>

                <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20">
                  <div className="text-xs font-medium text-red-900 dark:text-red-200 mb-1">
                    {t.deleteAccount}
                  </div>
                  <p className="text-[11px] text-red-700 dark:text-red-300/80 mb-2.5">
                    Permanently delete your account, documents, and all stored data. This action cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Are you ABSOLUTELY sure you want to permanently delete your account and all data?')) {
                        onDeleteAccount();
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
                  >
                    {t.deleteAccount}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => handleSavePreferences()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
