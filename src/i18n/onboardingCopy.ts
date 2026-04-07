import type { Locale } from './translations';

type IntentId = 'serieuse' | 'connexion' | 'decouverte' | 'verrai';
type GenderId = 'homme' | 'femme' | 'autre';
type LookingForId = 'hommes' | 'femmes' | 'tous';

type OnboardingCopy = {
  common: {
    continue: string;
    close: string;
    active: string;
    enable: string;
    off: string;
    on: string;
    years: string;
    launchServer: string;
  };
  top: {
    stepOf: string;
  };
  intro: {
    title: string;
    subtitle: string;
  };
  consent: {
    title: string;
    subtitle: string;
    age: string;
    terms: string;
  };
  auth: {
    title: string;
    phone: string;
    email: string;
    phoneLabel: string;
    phonePlaceholder: string;
    phoneValid: string;
    phoneInvalid: string;
    otpPlaceholder: string;
    otpTest: string;
    emailPlaceholder: string;
  };
  profile: {
    title: string;
    firstName: string;
    firstNamePlaceholder: string;
    birthDate: string;
    birthDatePlaceholder: string;
    zodiac: string;
    required18: string;
    city: string;
    cityPlaceholder: string;
    nationality: string;
    nationalityPlaceholder: string;
    languages: string;
  };
  genders: Record<GenderId, string>;
  lookingFor: {
    title: string;
    subtitle: string;
    label: Record<LookingForId, string>;
    ageRange: string;
    ageMin: string;
    ageMax: string;
    distanceMax: string;
  };
  photo: {
    title: string;
    subtitle: string;
    mainPhoto: string;
    photoLabel: string;
    added: string;
  };
  intent: {
    title: string;
    subtitle: string;
    options: Record<IntentId, { title: string; subtitle: string }>;
  };
  interests: {
    title: string;
    subtitle: string;
    selected: string;
  };
  translation: {
    title: string;
    subtitle: string;
    detectTitle: string;
    detectSubtitle: string;
    autoTitle: string;
    autoSubtitle: string;
  };
  verify: {
    title: string;
    subtitle: string;
    now: string;
    later: string;
  };
  permissions: {
    title: string;
    preciseLocation: string;
    notifications: string;
  };
  ready: {
    title: string;
    viewProfiles: string;
    improveProfile: string;
    profileAlt: string;
  };
  dateModal: {
    title: string;
    subtitle: string;
    day: string;
    month: string;
    year: string;
    selectedDate: string;
    confirm: string;
    months: string[];
  };
  cityModal: {
    title: string;
    subtitle: string;
    search: string;
    empty: string;
  };
  nationalityModal: {
    title: string;
    subtitle: string;
    search: string;
    empty: string;
  };
  languageLabels: Record<string, string>;
  interestLabels: Record<string, string>;
  zodiacLabels: Record<string, string>;
  nationalityCategories: Record<string, string>;
  cities: Record<string, string>;
  nationalities: Record<string, string>;
};

export const onboardingCopy: Record<Locale, OnboardingCopy> = {
  en: {
    common: {
      continue: 'Continue',
      close: 'Close',
      active: 'Active',
      enable: 'Enable',
      off: 'Off',
      on: 'On',
      years: 'years',
      launchServer: 'Launch server',
    },
    top: {
      stepOf: 'Step {step} of {total}',
    },
    intro: {
      title: 'EXOTIC',
      subtitle: 'Meet exotic people around you',
    },
    consent: {
      title: 'Basic conditions',
      subtitle: 'To keep our community safe, we need a few confirmations.',
      age: 'I am 18 years old or older',
      terms: 'I accept terms and privacy policy',
    },
    auth: {
      title: 'Create account',
      phone: 'Phone',
      email: 'Email',
      phoneLabel: 'Russia phone number',
      phonePlaceholder: '+7 (900) 000-00-00',
      phoneValid: 'Valid number (RU format)',
      phoneInvalid: 'Expected format: +7 (XXX) XXX-XX-XX',
      otpPlaceholder: 'OTP code',
      otpTest: 'Use test OTP (0000)',
      emailPlaceholder: 'name@example.com',
    },
    profile: {
      title: 'Essential profile',
      firstName: 'First name',
      firstNamePlaceholder: 'First name',
      birthDate: 'Birth date',
      birthDatePlaceholder: 'Select a date',
      zodiac: 'Zodiac sign',
      required18: '18+ required to continue.',
      city: 'Launch city',
      cityPlaceholder: 'Select a city',
      nationality: 'Nationality / origin',
      nationalityPlaceholder: 'Select nationality',
      languages: 'Spoken languages',
    },
    genders: {
      homme: 'Male',
      femme: 'Female',
      autre: 'Other',
    },
    lookingFor: {
      title: 'Who do you want to meet?',
      subtitle: 'This choice defines your matching affinity.',
      label: {
        hommes: 'Men',
        femmes: 'Women',
        tous: 'All',
      },
      ageRange: 'Age range',
      ageMin: 'Minimum age',
      ageMax: 'Maximum age',
      distanceMax: 'Max distance',
    },
    photo: {
      title: 'Add photos',
      subtitle: 'Profiles with 3+ photos perform better.',
      mainPhoto: 'Main photo',
      photoLabel: 'Photo',
      added: '{count}/{total} photo(s) added',
    },
    intent: {
      title: 'What are you looking for',
      subtitle: 'Choose a clear intention for better matching.',
      options: {
        serieuse: { title: 'Serious relationship', subtitle: 'Clear intention and quality dating' },
        connexion: { title: 'Flirt', subtitle: 'Light, fun and spontaneous conversation' },
        decouverte: { title: 'Exotic', subtitle: 'Intercultural discovery around you' },
        verrai: { title: 'Open', subtitle: 'Flexible and feeling-based' },
      },
    },
    interests: {
      title: 'Interests',
      subtitle: 'Choose at least 3 to enrich your profile.',
      selected: '{count}/5 selected',
    },
    translation: {
      title: 'Chat translation',
      subtitle: 'Language detection adapts automatically to your conversations.',
      detectTitle: 'Automatic language detection',
      detectSubtitle: 'Recommended for smooth conversations',
      autoTitle: 'Automatic translation',
      autoSubtitle: 'Always enabled in chat',
    },
    verify: {
      title: 'Verify your profile',
      subtitle: 'Verified profiles inspire more trust and get more matches.',
      now: 'Verify now',
      later: 'Skip for now',
    },
    permissions: {
      title: 'Useful permissions',
      preciseLocation: 'Precise location',
      notifications: 'Notifications',
    },
    ready: {
      title: 'Profile ready!',
      viewProfiles: 'See my profiles',
      improveProfile: 'Improve my profile',
      profileAlt: 'Profile',
    },
    dateModal: {
      title: 'Birth date',
      subtitle: 'Premium calendar picker',
      day: 'Day',
      month: 'Month',
      year: 'Year',
      selectedDate: 'Selected date',
      confirm: 'Confirm date',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    },
    cityModal: {
      title: 'Launch city',
      subtitle: 'Moscow, Voronezh, Saint Petersburg, Sochi',
      search: 'Search city',
      empty: 'No city found',
    },
    nationalityModal: {
      title: 'Nationality / origin',
      subtitle: 'Dynamic list of foreign communities in Russia',
      search: 'Search nationality',
      empty: 'No result',
    },
    languageLabels: {
      francais: 'French',
      anglais: 'English',
      russe: 'Russian',
      espagnol: 'Spanish',
      allemand: 'German',
      italien: 'Italian',
      chinois: 'Chinese',
      japonais: 'Japanese',
    },
    interestLabels: {
      musique: 'Music',
      sport: 'Sport',
      business: 'Business',
      voyage: 'Travel',
      cinema: 'Cinema',
      food: 'Food',
      mode: 'Fashion',
      spiritualite: 'Spirituality',
      tech: 'Tech',
      art: 'Art',
      danse: 'Dance',
      lifestyle: 'Lifestyle',
    },
    zodiacLabels: {
      aries: 'Aries',
      taurus: 'Taurus',
      gemini: 'Gemini',
      cancer: 'Cancer',
      leo: 'Leo',
      virgo: 'Virgo',
      libra: 'Libra',
      scorpio: 'Scorpio',
      sagittarius: 'Sagittarius',
      capricorn: 'Capricorn',
      aquarius: 'Aquarius',
      pisces: 'Pisces',
    },
    nationalityCategories: {
      russia: 'Russia',
      africa_west: 'West Africa',
      africa_central: 'Central Africa',
      africa_east: 'East Africa',
      africa_north: 'North Africa',
      asia_central: 'Central Asia',
      asia_east: 'East Asia',
      asia_south: 'South Asia',
      europe_east: 'Eastern Europe',
      europe: 'Europe',
      latam_caribbean: 'Latin America & Caribbean',
    },
    cities: {
      voronezh: 'Voronezh',
      moscow: 'Moscow',
      saint_petersburg: 'Saint Petersburg',
      sochi: 'Sochi',
    },
    nationalities: {
      russian: 'Russian',
      nigerian: 'Nigerian',
      ghanaian: 'Ghanaian',
      beninese: 'Beninese',
      senegalese: 'Senegalese',
      ivorian: 'Ivorian',
      guinean: 'Guinean',
      malian: 'Malian',
      cameroonian: 'Cameroonian',
      congolese_drc: 'Congolese (DRC)',
      congolese_rc: 'Congolese (Republic of the Congo)',
      gabonese: 'Gabonese',
      angolan: 'Angolan',
      chadian: 'Chadian',
      ethiopian: 'Ethiopian',
      kenyan: 'Kenyan',
      rwandan: 'Rwandan',
      ugandan: 'Ugandan',
      tanzanian: 'Tanzanian',
      egyptian: 'Egyptian',
      moroccan: 'Moroccan',
      algerian: 'Algerian',
      tunisian: 'Tunisian',
      uzbek: 'Uzbek',
      tajik: 'Tajik',
      kyrgyz: 'Kyrgyz',
      kazakh: 'Kazakh',
      turkmen: 'Turkmen',
      chinese: 'Chinese',
      north_korean: 'North Korean',
      vietnamese: 'Vietnamese',
      indian: 'Indian',
      pakistani: 'Pakistani',
      bangladeshi: 'Bangladeshi',
      belarusian: 'Belarusian',
      moldovan: 'Moldovan',
      armenian: 'Armenian',
      azeri: 'Azerbaijani',
      georgian: 'Georgian',
      german: 'German',
      french: 'French',
      italian: 'Italian',
      serbian: 'Serbian',
      ukrainian: 'Ukrainian',
      cuban: 'Cuban',
      brazilian: 'Brazilian',
      colombian: 'Colombian',
      ecuadorian: 'Ecuadorian',
      venezuelan: 'Venezuelan',
    },
  },
  ru: {
    common: {
      continue: 'Продолжить',
      close: 'Закрыть',
      active: 'Активно',
      enable: 'Включить',
      off: 'Выкл',
      on: 'Вкл',
      years: 'лет',
      launchServer: 'Стартовый сервер',
    },
    top: {
      stepOf: 'Шаг {step} из {total}',
    },
    intro: {
      title: 'ЭКЗОТИК',
      subtitle: 'Знакомься с экзотичными людьми рядом',
    },
    consent: {
      title: 'Базовые условия',
      subtitle: 'Чтобы сохранить безопасность сообщества, подтвердите несколько пунктов.',
      age: 'Мне 18 лет или больше',
      terms: 'Принимаю условия и политику конфиденциальности',
    },
    auth: {
      title: 'Создание аккаунта',
      phone: 'Телефон',
      email: 'Email',
      phoneLabel: 'Номер телефона РФ',
      phonePlaceholder: '+7 (900) 000-00-00',
      phoneValid: 'Номер корректный (формат РФ)',
      phoneInvalid: 'Ожидаемый формат: +7 (XXX) XXX-XX-XX',
      otpPlaceholder: 'OTP код',
      otpTest: 'Использовать тест OTP (0000)',
      emailPlaceholder: 'name@example.com',
    },
    profile: {
      title: 'Основной профиль',
      firstName: 'Имя',
      firstNamePlaceholder: 'Имя',
      birthDate: 'Дата рождения',
      birthDatePlaceholder: 'Выберите дату',
      zodiac: 'Знак зодиака',
      required18: 'Для продолжения нужен возраст 18+.',
      city: 'Город запуска',
      cityPlaceholder: 'Выберите город',
      nationality: 'Национальность / происхождение',
      nationalityPlaceholder: 'Выберите национальность',
      languages: 'Языки',
    },
    genders: {
      homme: 'Мужчина',
      femme: 'Женщина',
      autre: 'Другое',
    },
    lookingFor: {
      title: 'Кого вы хотите встретить?',
      subtitle: 'Этот выбор влияет на релевантность подбора.',
      label: {
        hommes: 'Мужчин',
        femmes: 'Женщин',
        tous: 'Всех',
      },
      ageRange: 'Возрастной диапазон',
      ageMin: 'Минимальный возраст',
      ageMax: 'Максимальный возраст',
      distanceMax: 'Макс. дистанция',
    },
    photo: {
      title: 'Добавьте фото',
      subtitle: 'Профили с 3+ фото получают больше внимания.',
      mainPhoto: 'Главное фото',
      photoLabel: 'Фото',
      added: 'Добавлено фото: {count}/{total}',
    },
    intent: {
      title: 'Что вы ищете',
      subtitle: 'Выберите четкое намерение для лучшего мэтчинга.',
      options: {
        serieuse: { title: 'Серьезные отношения', subtitle: 'Осознанные знакомства с намерением' },
        connexion: { title: 'Флирт', subtitle: 'Легко, весело и спонтанно' },
        decouverte: { title: 'Exotic', subtitle: 'Межкультурные знакомства рядом' },
        verrai: { title: 'Open', subtitle: 'Гибкий формат по настроению' },
      },
    },
    interests: {
      title: 'Интересы',
      subtitle: 'Выберите минимум 3 интереса.',
      selected: 'Выбрано: {count}/5',
    },
    translation: {
      title: 'Перевод чата',
      subtitle: 'Система автоматически определяет язык переписки.',
      detectTitle: 'Автоопределение языка',
      detectSubtitle: 'Рекомендуется для плавного общения',
      autoTitle: 'Автоперевод',
      autoSubtitle: 'Всегда включен в чате',
    },
    verify: {
      title: 'Подтвердите профиль',
      subtitle: 'Проверенные профили вызывают больше доверия и получают больше мэтчей.',
      now: 'Подтвердить сейчас',
      later: 'Пропустить пока',
    },
    permissions: {
      title: 'Полезные разрешения',
      preciseLocation: 'Точная геолокация',
      notifications: 'Уведомления',
    },
    ready: {
      title: 'Профиль готов!',
      viewProfiles: 'Смотреть анкеты',
      improveProfile: 'Улучшить профиль',
      profileAlt: 'Профиль',
    },
    dateModal: {
      title: 'Дата рождения',
      subtitle: 'Премиум-календарь',
      day: 'День',
      month: 'Месяц',
      year: 'Год',
      selectedDate: 'Выбранная дата',
      confirm: 'Подтвердить дату',
      months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    },
    cityModal: {
      title: 'Город запуска',
      subtitle: 'Москва, Воронеж, Санкт-Петербург, Сочи',
      search: 'Поиск города',
      empty: 'Город не найден',
    },
    nationalityModal: {
      title: 'Национальность / происхождение',
      subtitle: 'Динамический список иностранных сообществ в России',
      search: 'Поиск национальности',
      empty: 'Ничего не найдено',
    },
    languageLabels: {
      francais: 'Французский',
      anglais: 'Английский',
      russe: 'Русский',
      espagnol: 'Испанский',
      allemand: 'Немецкий',
      italien: 'Итальянский',
      chinois: 'Китайский',
      japonais: 'Японский',
    },
    interestLabels: {
      musique: 'Музыка',
      sport: 'Спорт',
      business: 'Бизнес',
      voyage: 'Путешествия',
      cinema: 'Кино',
      food: 'Еда',
      mode: 'Мода',
      spiritualite: 'Духовность',
      tech: 'Технологии',
      art: 'Искусство',
      danse: 'Танцы',
      lifestyle: 'Лайфстайл',
    },
    zodiacLabels: {
      aries: 'Овен',
      taurus: 'Телец',
      gemini: 'Близнецы',
      cancer: 'Рак',
      leo: 'Лев',
      virgo: 'Дева',
      libra: 'Весы',
      scorpio: 'Скорпион',
      sagittarius: 'Стрелец',
      capricorn: 'Козерог',
      aquarius: 'Водолей',
      pisces: 'Рыбы',
    },
    nationalityCategories: {
      russia: 'Россия',
      africa_west: 'Западная Африка',
      africa_central: 'Центральная Африка',
      africa_east: 'Восточная Африка',
      africa_north: 'Северная Африка',
      asia_central: 'Центральная Азия',
      asia_east: 'Восточная Азия',
      asia_south: 'Южная Азия',
      europe_east: 'Восточная Европа',
      europe: 'Европа',
      latam_caribbean: 'Латинская Америка и Карибы',
    },
    cities: {
      voronezh: 'Воронеж',
      moscow: 'Москва',
      saint_petersburg: 'Санкт-Петербург',
      sochi: 'Сочи',
    },
    nationalities: {
      russian: 'Русская',
      nigerian: 'Нигерийская',
      ghanaian: 'Ганская',
      beninese: 'Бенинская',
      senegalese: 'Сенегальская',
      ivorian: 'Ивуарийская',
      guinean: 'Гвинейская',
      malian: 'Малийская',
      cameroonian: 'Камерунская',
      congolese_drc: 'Конголезская (ДРК)',
      congolese_rc: 'Конголезская (Республика Конго)',
      gabonese: 'Габонская',
      angolan: 'Ангольская',
      chadian: 'Чадская',
      ethiopian: 'Эфиопская',
      kenyan: 'Кенийская',
      rwandan: 'Руандийская',
      ugandan: 'Угандийская',
      tanzanian: 'Танзанийская',
      egyptian: 'Египетская',
      moroccan: 'Марокканская',
      algerian: 'Алжирская',
      tunisian: 'Тунисская',
      uzbek: 'Узбекская',
      tajik: 'Таджикская',
      kyrgyz: 'Киргизская',
      kazakh: 'Казахская',
      turkmen: 'Туркменская',
      chinese: 'Китайская',
      north_korean: 'Северокорейская',
      vietnamese: 'Вьетнамская',
      indian: 'Индийская',
      pakistani: 'Пакистанская',
      bangladeshi: 'Бангладешская',
      belarusian: 'Белорусская',
      moldovan: 'Молдавская',
      armenian: 'Армянская',
      azeri: 'Азербайджанская',
      georgian: 'Грузинская',
      german: 'Немецкая',
      french: 'Французская',
      italian: 'Итальянская',
      serbian: 'Сербская',
      ukrainian: 'Украинская',
      cuban: 'Кубинская',
      brazilian: 'Бразильская',
      colombian: 'Колумбийская',
      ecuadorian: 'Эквадорская',
      venezuelan: 'Венесуэльская',
    },
  },
};
