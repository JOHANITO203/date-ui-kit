import { useNavigate, useLocation } from 'react-router-dom';
import { ICONS } from '../types';
import { useI18n } from '../i18n/I18nProvider';
import TabBar, { type TabItem } from './ui/TabBar';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const tabs = [
    { id: 'discover', icon: ICONS.Discover, label: t('nav.discover'), path: '/discover' },
    { id: 'likes', icon: ICONS.Likes, label: t('nav.likes'), badge: true, path: '/likes' },
    { id: 'messages', icon: ICONS.Messages, label: t('nav.messages'), badge: true, path: '/messages' },
    { id: 'boost', icon: ICONS.Boost, label: t('nav.boost'), path: '/boost' },
    { id: 'profile', icon: ICONS.Profile, label: t('nav.profile'), path: '/profile' },
  ];

  const items: TabItem[] = tabs.map((tab) => {
    const Icon = tab.icon;
    const isActive =
      location.pathname === tab.path ||
      (tab.path === '/messages' && location.pathname.startsWith('/chat/')) ||
      (tab.path === '/profile' && location.pathname.startsWith('/settings'));
    return {
      key: tab.id,
      label: tab.label,
      active: isActive,
      onPress: () => navigate(tab.path),
      icon: (
        <span className="relative inline-flex">
          <Icon size={24} strokeWidth={isActive ? 2.5 : 2} fill={isActive ? 'currentColor' : 'none'} />
          {tab.badge && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-black" />
          )}
        </span>
      ),
    };
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <TabBar items={items} />
    </div>
  );
};

export default BottomNav;
