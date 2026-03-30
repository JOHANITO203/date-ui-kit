import { 
  Heart, 
  MessageCircle, 
  Zap, 
  User, 
  Compass, 
  X, 
  Star, 
  CheckCircle2, 
  ChevronLeft, 
  Camera, 
  MapPin, 
  Settings,
  Globe,
  Send,
  Languages,
  Mail,
  Phone,
  Smartphone,
  Fingerprint,
  RotateCcw,
  Info,
  Shield,
  Bell,
  LogOut,
  Edit,
  Eye,
  HelpCircle,
  Ghost,
  Lock
} from 'lucide-react';

export type Screen = 'splash' | 'onboarding' | 'main';
export type Tab = 'discover' | 'likes' | 'messages' | 'boost' | 'profile';

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  distance: string;
  languages: string[];
  bio: string;
  photos: string[];
  verified: boolean;
  compatibility: number;
  interests: string[];
}

export const MOCK_USERS: UserProfile[] = [
  {
    id: '1',
    name: 'Elena',
    age: 24,
    distance: '2 km away',
    languages: ['English', 'Spanish'],
    bio: 'Art lover and world traveler. Looking for someone to explore hidden gems with.',
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80'
    ],
    verified: true,
    compatibility: 94,
    interests: ['Art', 'Travel', 'Wine']
  },
  {
    id: '2',
    name: 'Marcus',
    age: 27,
    distance: '5 km away',
    languages: ['English', 'French'],
    bio: 'Tech enthusiast and coffee addict. Let\'s talk about the future.',
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80'
    ],
    verified: true,
    compatibility: 88,
    interests: ['Tech', 'Coffee', 'Design']
  },
  {
    id: '3',
    name: 'Sofia',
    age: 22,
    distance: '1 km away',
    languages: ['Italian', 'English'],
    bio: 'Architecture student. I see beauty in every corner of the city.',
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
    ],
    verified: false,
    compatibility: 91,
    interests: ['Architecture', 'Photography', 'Pizza']
  },
  {
    id: '4',
    name: 'Lucas',
    age: 29,
    distance: '3 km away',
    languages: ['English', 'German'],
    bio: 'Fitness coach and amateur chef. I believe a good meal is the best way to end the day.',
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=800&q=80'
    ],
    verified: true,
    compatibility: 85,
    interests: ['Fitness', 'Cooking', 'Hiking']
  },
  {
    id: '5',
    name: 'Amélie',
    age: 25,
    distance: '4 km away',
    languages: ['French', 'English'],
    bio: 'Music is my life. Always looking for the next best concert in town.',
    photos: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80'
    ],
    verified: false,
    compatibility: 92,
    interests: ['Music', 'Concerts', 'Dancing']
  },
  {
    id: '6',
    name: 'Julian',
    age: 26,
    distance: '6 km away',
    languages: ['English', 'Japanese'],
    bio: 'Anime fan and casual gamer. Let\'s go on a quest together!',
    photos: [
      'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80'
    ],
    verified: true,
    compatibility: 79,
    interests: ['Anime', 'Gaming', 'Sushi']
  },
  {
    id: '7',
    name: 'Clara',
    age: 23,
    distance: '2 km away',
    languages: ['English', 'French'],
    bio: 'Yoga instructor and brunch enthusiast. Finding balance in a busy world.',
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=800&q=80'
    ],
    verified: true,
    compatibility: 96,
    interests: ['Fashion', 'Yoga', 'Brunch']
  }
];

export const ICONS = {
  Discover: Compass,
  Likes: Heart,
  Messages: MessageCircle,
  Boost: Zap,
  Profile: User,
  Heart,
  Zap,
  X,
  Star,
  CheckCircle2,
  ChevronLeft,
  Camera,
  MapPin,
  Settings,
  Globe,
  Send,
  Languages,
  Mail,
  Phone,
  Smartphone,
  Fingerprint,
  Rewind: RotateCcw,
  Info,
  Shield,
  Bell,
  LogOut,
  Edit,
  Eye,
  HelpCircle,
  Ghost,
  Lock
};
