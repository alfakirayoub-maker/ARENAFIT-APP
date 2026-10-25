import type { Translation } from './fr';

// Draft translation — to be reviewed by a native speaker before release.
const ar: Translation = {
  common: {
    seeAll: 'عرض الكل',
    retry: 'إعادة المحاولة',
    close: 'إغلاق',
    back: 'رجوع',
    loading: 'جارٍ التحميل…',
  },
  tabs: {
    home: 'الرئيسية',
    planning: 'الجدول',
    activities: 'الأنشطة',
    news: 'الأخبار',
    profile: 'حسابي',
  },
  home: {
    greeting: 'مرحبًا، {{name}}',
    greetingAnonymous: 'مرحبًا',
    nextClass: 'الحصة القادمة',
    todaySchedule: 'جدول اليوم',
    favoriteActivities: 'أنشطتي المفضلة',
  },
  planning: {
    title: 'الجدول',
    subtitle: 'جميع حصص الأسبوع',
  },
  activities: {
    title: 'الأنشطة',
    subtitle: 'اكتشف برامج Arena Fit',
  },
  news: {
    title: 'الأخبار',
    subtitle: 'حياة النادي',
  },
  profile: {
    title: 'حسابي',
  },
  reminder: {
    cta: 'ذكّرني',
    set: 'تم تفعيل التذكير',
  },
  guestPass: {
    offer: 'أهدِ تذكرة',
    guestMode: 'وضع الضيف',
  },
  categories: {
    all: 'الكل',
    fitness: 'Fitness',
    combat: 'Combat',
    dance: 'Dance',
    aqua: 'Aqua',
    kids: 'Kids',
    cycling: 'Cycling',
    mind_body: 'Mind & Body',
  },
  levels: {
    all_levels: 'جميع المستويات',
    beginner: 'مبتدئ',
    intermediate: 'متوسط',
    advanced: 'متقدم',
  },
  empty: {
    noClassesToday: {
      title: 'لا توجد حصص اليوم',
      body: 'خذ وقتك للاسترجاع، أو اطّلع على جدول الأسبوع.',
    },
    noNews: {
      title: 'لا توجد أخبار',
      body: 'ستظهر أخبار النادي هنا.',
    },
    noFavorites: {
      title: 'لا توجد أنشطة مفضلة',
      body: 'أضف أنشطتك المفضلة للوصول إليها بسرعة.',
    },
    noInvitations: {
      title: 'لا توجد دعوات',
      body: 'أهدِ تذكرة لأحد أقاربك ليكتشف Arena Fit.',
    },
    comingSoon: {
      title: 'قريبًا',
      body: 'هذه الشاشة ستتوفر في الإصدار القادم.',
    },
  },
  errors: {
    generic: 'حدث خطأ ما.',
    notFound: 'الصفحة غير موجودة',
  },
  a11y: {
    logo: 'Arena Fit',
  },
};

export default ar;
