from pathlib import Path
import re

path = Path("src/i18n/translations.ts")
text = path.read_text(encoding="utf-8")

new_ru_boost = """    boost: {
      currency: '\\u20BD',
      badge: 'Премиум окно видимости',
      heroLead: 'Усиль свой',
      heroAccent: 'импульс',
      heroSubtitle:
        'Активируй премиум окно видимости, чтобы получать больше лайков, больше матчей и больше реальных диалогов.',
      activateBoost: 'Активировать Буст',
      boostActive: 'Буст активен {timer}',
      subscribePrefix: 'ПОДПИСАТЬСЯ НА ',
      secureHint: 'Отмена в любой момент - Безопасная оплата',
      jumpSection: 'Перейти к разделу буста {index}',
      flash: {
        title: 'Быстрые бусты',
        subtitle: 'Мгновенное ускорение',
        body: 'Буст выводит твой профиль в активные локальные зоны прямо сейчас и усиливает видимость.',
        points: {
          0: 'Больше показов в часы пиковой активности',
          1: 'Выше шанс быстрее начать диалог',
        },
      },
      metrics: {
        matches: { title: 'Матчи', desc: 'Больше качественных диалогов' },
        security: { title: 'Доверие', desc: 'Премиум статус и подтверждение' },
        rhythm: { title: 'Скорость', desc: 'Быстрее к первому контакту' },
      },
      tiers: {
        periodMonth: '/ МЕСЯЦ',
        essential: {
          ctaName: 'ESSENTIAL',
          name: 'VIBE Essential',
          tag: 'БАЗОВЫЙ',
          price: '499{currency}',
          features: {
            0: 'Смотреть кто лайкнул тебя',
            1: 'ИИ перевод в чате',
            2: '5 SuperLikes в день',
            3: 'Без рекламы',
            4: 'Подтвержденный бейдж',
          },
        },
        gold: {
          ctaName: 'GOLD',
          name: 'VIBE Gold',
          tag: 'ПОПУЛЯРНЫЙ',
          price: '899{currency}',
          features: {
            0: 'Все из Essential',
            1: '10 SuperLikes в день',
            2: '1 Буст в неделю',
            3: '3 Rewinds в день',
            4: 'Скрыть возраст/дистанцию',
          },
        },
        platinum: {
          ctaName: 'PLATINUM',
          name: 'VIBE Platinum',
          tag: 'ЭЛИТА',
          price: '1490{currency}',
          features: {
            0: 'Все из Gold',
            1: '20 SuperLikes в день',
            2: '1 Буст в день',
            3: '10 Rewinds в день',
            4: 'ShadowGhost + кто онлайн',
            5: '1 Travel Pass в месяц',
          },
        },
      },
      instant: {
        boost: {
          label: 'Буст видимости',
          desc: 'Усиление видимости профиля на 30 минут в часы активного локального трафика.',
          details: {
            0: 'Приоритет в Discover',
            1: 'Мгновенная активация',
          },
          price: '149{currency}',
          meta: 'Один буст',
        },
        premium: {
          label: 'Premium verified',
          desc: 'Подтвержденный статус и комфорт переписки в одном месячном плане.',
          details: {
            0: 'Видимый подтвержденный бейдж',
            1: 'Базовый премиум-комфорт',
          },
          price: '499{currency}',
          meta: 'Месячный план',
        },
        superlike: {
          label: 'Токены SuperLike',
          desc: 'Покажи более сильный интерес и попади выше в первых контактах.',
          details: {
            0: 'Эмоциональный импульсный продукт',
            1: 'Приоритетный сигнал инициативы',
          },
          price: '199{currency}',
          meta: '5 токенов',
        },
        rewind: {
          label: 'Токены Rewind',
          desc: 'Отмени свайп и верни профиль, который пролистал слишком быстро.',
          details: {
            0: 'Вернуть недавний пропуск',
            1: 'Полезно при сомнении',
          },
          price: '299{currency}',
          meta: '5 токенов',
        },
        icebreaker: {
          label: 'IceBreaker 24ч',
          desc: 'Открой, кто лайкнул тебя сейчас, и начни разговор увереннее.',
          details: {
            0: 'Триггер конверсии через любопытство',
            1: 'Короткий доступ к премиум-информации',
          },
          price: '149{currency}',
          meta: 'Доступ 24ч',
        },
      },
      passes: {
        day: {
          label: 'Дневной пакет',
          desc: 'Короткий тест премиум-опыта без долгих обязательств.',
          details: {
            0: 'Быстрый пробный запуск',
            1: 'Подходит для первой покупки',
          },
          price: '99{currency}',
          tag: '24ч',
        },
        week: {
          label: 'Недельный пакет',
          desc: '7 дней комфортного режима без замены месячной подписки.',
          details: {
            0: 'Средний горизонт теста',
            1: 'Сбалансированная ценность',
          },
          price: '299{currency}',
          tag: '7 дней',
        },
        travel: {
          label: 'Travel Pass',
          desc: 'Открой один город на 7 дней и начинай матчи до поездки.',
          details: {
            0: 'Только один активный город',
            1: 'Сценарий знакомства заранее',
          },
          price: '599{currency}',
          tag: '7 дней',
        },
      },
      bundles: {
        starter: {
          label: 'Starter',
          desc: '5 SuperLikes + 2 Буста + без рекламы (3 дня)',
          details: {
            0: 'Легкий вход в первую покупку',
            1: 'Лучший старт платного поведения',
          },
          price: '99{currency}',
          tag: 'Первая покупка',
        },
        pro: {
          label: 'Dating Pro',
          desc: '10 Бустов + 30 SuperLikes + 20 Rewinds',
          details: {
            0: 'Пакет производительности для активных',
            1: 'Сильная ценность без разрушения дефицита',
          },
          price: '1490{currency}',
          tag: 'Лучшая производительность',
        },
        premiumplus: {
          label: 'Elite / VIP',
          desc: 'Элитный месячный статус + премиум окна размещения',
          details: {
            0: 'Статусный социальный уровень',
            1: 'Приоритетная поддержка и видимость',
          },
          price: '2990{currency}',
          tag: 'Максимальный статус',
        },
      },
      catalog: {
        instant: 'Мгновенные товары',
        passes: 'Пакеты по времени',
        bundles: 'Бандлы',
      },
      buy: {
        buy: 'Купить',
        choose: 'Выбрать',
        bundle: 'Взять бандл',
      },
    },
"""

ru_start = text.index("  ru: {")
ru_end = text.index("\n  },\n};", ru_start)
ru_section = text[ru_start:ru_end]

pattern = re.compile(r"\n    boost: \{[\s\S]*?\n    \},\n\s*    profile: \{")
if not pattern.search(ru_section):
    raise RuntimeError("RU boost block not found")

ru_section = pattern.sub("\n" + new_ru_boost + "    profile: {", ru_section, count=1)
text = text[:ru_start] + ru_section + text[ru_end:]
path.write_text(text, encoding="utf-8")
print("RU boost block fixed")
