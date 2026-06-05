export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ru";
export const LOCALE_COOKIE = "vivi_locale";

export function isLocale(value: string | undefined): value is Locale {
  return value === "ru" || value === "en";
}

/** Replaces {placeholders} in a template string. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

const ru = {
  common: {
    appName: "Vivi",
    brandSubtitle: "AI-рекрутинг с видеоинтервью",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Редактировать",
    add: "Добавить",
    copy: "Копировать",
    copied: "Скопировано",
    open: "Открыть",
    home: "На главную",
    of: "из",
  },
  theme: { light: "Светлая", dark: "Тёмная", system: "Системная" },
  locale: { label: "Язык", ru: "Русский", en: "English" },
  landing: {
    signIn: "Войти",
    start: "Начать",
    openApp: "Открыть приложение",
    badge: "AI создаёт вакансию и проводит видеоинтервью",
    heroTitle: "Нанимайте быстрее с AI-рекрутером",
    heroSubtitle:
      "Опишите вакансию в чате — Vivi уточнит детали, соберёт описание и создаст ссылку с видеоинтервью для кандидатов. Все ответы — в одном месте.",
    ctaCreate: "Создать вакансию",
    f1Title: "Чат с AI",
    f1Text:
      "Опишите вакансию свободным текстом — AI задаст уточняющие вопросы и сформирует описание.",
    f2Title: "Ссылка для кандидатов",
    f2Text:
      "Уникальная страница вакансии с формой отклика — делитесь одной ссылкой.",
    f3Title: "Видеоинтервью",
    f3Text:
      "Кандидаты отвечают на вопросы под вакансию на видео. Вы оцениваете в удобное время.",
  },
  auth: {
    title: "Вход в аккаунт",
    subtitle: "Введите email — отправим ссылку для входа.",
    emailLabel: "Email",
    emailPlaceholder: "you@company.com",
    sendLink: "Отправить ссылку",
    checkEmailTitle: "Проверьте почту",
    checkEmailDesc:
      "Мы отправили ссылку для входа на {email}. Ссылка действует 5 минут.",
    useAnotherEmail: "Использовать другой email",
    terms: "Продолжая, вы соглашаетесь с условиями использования.",
    errorSend: "Не удалось отправить ссылку",
  },
  sidebar: {
    newVacancy: "Новая вакансия",
    noVacancies: "Пока нет вакансий. Создайте первую.",
    rename: "Переименовать",
    renameTitle: "Переименовать вакансию",
    nameLabel: "Название",
    signOut: "Выйти",
    noName: "Без имени",
  },
  appHome: {
    title: "Создайте вакансию",
    subtitle:
      "Опишите роль в чате — AI задаст уточняющие вопросы, соберёт описание и вопросы для видеоинтервью.",
  },
  chat: {
    emptyTitle: "Опишите вакансию",
    emptySubtitle:
      "Напишите пару слов о роли — я задам уточняющие вопросы и помогу собрать описание и вопросы для видеоинтервью.",
    suggestion1: "Senior Frontend разработчик, React, удалённо",
    suggestion2: "Менеджер по продажам B2B в Москве",
    suggestion3: "Продуктовый дизайнер, гибрид, middle+",
    placeholder: "Сообщение AI-рекрутеру…",
    draftUpdating: "Собираю черновик…",
    draftUpdated: "Черновик вакансии обновлён",
    error: "Ошибка: {message}. Проверьте, что задан OPENAI_API_KEY.",
  },
  panel: {
    details: "Детали",
    tabVacancy: "Вакансия",
    tabCandidates: "Кандидаты",
    publishTitle: "Публикация",
    publishReady:
      "Описание и вопросы готовы. Опубликуйте, чтобы получить ссылку для кандидатов.",
    publishNotReady:
      "Завершите описание и вопросы в чате — затем сможете опубликовать.",
    publishBtn: "Опубликовать",
    publishedTitle: "Вакансия опубликована",
    publishedDesc:
      "Отправьте эту ссылку кандидатам — они увидят описание и пройдут видеоинтервью.",
    unpublish: "Снять с публикации",
    descriptionTitle: "Описание",
    descriptionPlaceholder:
      "Описание появится здесь после диалога с AI в чате слева.",
    questionsTitle: "Вопросы видеоинтервью",
    questionsPlaceholder: "Вопросы для кандидатов сформирует AI.",
    addQuestion: "Добавить вопрос",
    questionTextPlaceholder: "Текст вопроса",
    descEditPlaceholder: "Описание вакансии в формате Markdown…",
    copyToast: "Ссылка скопирована",
    publishedToast: "Вакансия опубликована",
    publishError: "Не удалось опубликовать",
    savedToast: "Сохранено",
    saveError: "Не удалось сохранить",
  },
  candidates: {
    emptyTitle: "Пока нет откликов",
    emptyDesc:
      "Опубликуйте вакансию и отправьте ссылку кандидатам. Их видеоинтервью появятся здесь.",
    filterStatus: "Статус",
    filterAll: "Все",
    sortNewest: "Сначала новые",
    sortRating: "По оценке",
    backToList: "Назад к списку",
    noVideos: "Кандидат ещё не записал видеоинтервью.",
    question: "Вопрос {n}",
    statusUpdated: "Статус обновлён",
    answersOf: "Ответ {n} из {m}",
    noMatch: "Нет кандидатов под фильтр.",
    st_applied: "Откликнулся",
    st_interviewing: "Проходит интервью",
    st_completed: "Интервью пройдено",
    st_shortlisted: "В шорт-листе",
    st_rejected: "Отклонён",
    setShortlisted: "В шорт-лист",
    setRejected: "Отклонить",
  },
  publicVacancy: {
    respondHeader: "Отклик на вакансию",
    descriptionTitle: "Описание вакансии",
    skillsTitle: "Навыки",
    questionsNoteOne: "{count} вопрос в видеоинтервью",
    questionsNoteFew: "{count} вопроса в видеоинтервью",
    questionsNoteMany: "{count} вопросов в видеоинтервью",
  },
  apply: {
    header: "Откликнуться",
    nameLabel: "Имя и фамилия",
    namePlaceholder: "Иван Иванов",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    phoneLabel: "Телефон",
    optional: "необязательно",
    phonePlaceholder: "+7 900 000-00-00",
    submit: "Откликнуться и пройти видеоинтервью",
    note: "После отклика вас ждёт короткое видеоинтервью — отвечайте в удобном темпе.",
  },
  interview: {
    greeting: "Здравствуйте, {name}!",
    introDesc:
      "Вас ждёт короткое видеоинтервью из {count} {questions}. На каждый вопрос — видеоответ с камеры. Можно перезаписать ответ перед отправкой.",
    qOne: "вопроса",
    qFew: "вопросов",
    qMany: "вопросов",
    tip1: "Найдите тихое место с хорошим освещением",
    tip2: "Разрешите доступ к камере и микрофону",
    tip3: "Отвечайте в удобном темпе",
    start: "Начать интервью",
    deniedTitle: "Нет доступа к камере",
    deniedDesc:
      "Разрешите доступ к камере и микрофону в настройках браузера, затем попробуйте снова.",
    retry: "Повторить",
    progress: "Вопрос {n} из {m}",
    record: "Записать ответ",
    stop: "Остановить",
    retake: "Перезаписать",
    submitNext: "Отправить и далее",
    finish: "Завершить интервью",
    maxNote:
      "Максимум {min} мин на ответ. Отвечайте спокойно — можно перезаписать.",
    uploadError:
      "Не удалось загрузить ответ. Проверьте соединение и попробуйте снова.",
    doneTitle: "Спасибо, {name}!",
    doneDesc:
      "Ваши видеоответы отправлены рекрутёру. Мы свяжемся с вами по итогам рассмотрения.",
    doneDescNoQuestions:
      "Ваш отклик получен. Рекрутёр свяжется с вами.",
  },
};

const en: typeof ru = {
  common: {
    appName: "Vivi",
    brandSubtitle: "AI recruiting with video interviews",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    copy: "Copy",
    copied: "Copied",
    open: "Open",
    home: "Home",
    of: "of",
  },
  theme: { light: "Light", dark: "Dark", system: "System" },
  locale: { label: "Language", ru: "Русский", en: "English" },
  landing: {
    signIn: "Sign in",
    start: "Get started",
    openApp: "Open app",
    badge: "AI builds the vacancy and runs video interviews",
    heroTitle: "Hire faster with an AI recruiter",
    heroSubtitle:
      "Describe the role in a chat — Vivi clarifies the details, drafts the description and creates a link with a video interview for candidates. All answers in one place.",
    ctaCreate: "Create a vacancy",
    f1Title: "AI chat",
    f1Text:
      "Describe the role in plain text — the AI asks clarifying questions and drafts the description.",
    f2Title: "A link for candidates",
    f2Text: "A unique vacancy page with an application form — share one link.",
    f3Title: "Video interviews",
    f3Text:
      "Candidates answer role-specific questions on video. You review whenever it suits you.",
  },
  auth: {
    title: "Sign in",
    subtitle: "Enter your email — we'll send a sign-in link.",
    emailLabel: "Email",
    emailPlaceholder: "you@company.com",
    sendLink: "Send link",
    checkEmailTitle: "Check your email",
    checkEmailDesc:
      "We sent a sign-in link to {email}. It's valid for 5 minutes.",
    useAnotherEmail: "Use a different email",
    terms: "By continuing you agree to the terms of service.",
    errorSend: "Couldn't send the link",
  },
  sidebar: {
    newVacancy: "New vacancy",
    noVacancies: "No vacancies yet. Create your first.",
    rename: "Rename",
    renameTitle: "Rename vacancy",
    nameLabel: "Title",
    signOut: "Sign out",
    noName: "No name",
  },
  appHome: {
    title: "Create a vacancy",
    subtitle:
      "Describe the role in the chat — the AI asks clarifying questions and assembles the description and video-interview questions.",
  },
  chat: {
    emptyTitle: "Describe the role",
    emptySubtitle:
      "Write a few words about the role — I'll ask clarifying questions and help assemble the description and interview questions.",
    suggestion1: "Senior Frontend developer, React, remote",
    suggestion2: "B2B sales manager in Moscow",
    suggestion3: "Product designer, hybrid, middle+",
    placeholder: "Message the AI recruiter…",
    draftUpdating: "Building the draft…",
    draftUpdated: "Vacancy draft updated",
    error: "Error: {message}. Make sure OPENAI_API_KEY is set.",
  },
  panel: {
    details: "Details",
    tabVacancy: "Vacancy",
    tabCandidates: "Candidates",
    publishTitle: "Publishing",
    publishReady:
      "Description and questions are ready. Publish to get a link for candidates.",
    publishNotReady:
      "Finish the description and questions in the chat — then you can publish.",
    publishBtn: "Publish",
    publishedTitle: "Vacancy published",
    publishedDesc:
      "Send this link to candidates — they'll see the description and take the video interview.",
    unpublish: "Unpublish",
    descriptionTitle: "Description",
    descriptionPlaceholder:
      "The description will appear here after the chat with the AI on the left.",
    questionsTitle: "Video interview questions",
    questionsPlaceholder: "The AI will generate questions for candidates.",
    addQuestion: "Add question",
    questionTextPlaceholder: "Question text",
    descEditPlaceholder: "Vacancy description in Markdown…",
    copyToast: "Link copied",
    publishedToast: "Vacancy published",
    publishError: "Couldn't publish",
    savedToast: "Saved",
    saveError: "Couldn't save",
  },
  candidates: {
    emptyTitle: "No applications yet",
    emptyDesc:
      "Publish the vacancy and send the link to candidates. Their video interviews will appear here.",
    filterStatus: "Status",
    filterAll: "All",
    sortNewest: "Newest first",
    sortRating: "By rating",
    backToList: "Back to list",
    noVideos: "The candidate hasn't recorded the interview yet.",
    question: "Question {n}",
    statusUpdated: "Status updated",
    answersOf: "Answer {n} of {m}",
    noMatch: "No candidates match the filter.",
    st_applied: "Applied",
    st_interviewing: "Interviewing",
    st_completed: "Interview done",
    st_shortlisted: "Shortlisted",
    st_rejected: "Rejected",
    setShortlisted: "Shortlist",
    setRejected: "Reject",
  },
  publicVacancy: {
    respondHeader: "Apply for this role",
    descriptionTitle: "Job description",
    skillsTitle: "Skills",
    questionsNoteOne: "{count} question in the video interview",
    questionsNoteFew: "{count} questions in the video interview",
    questionsNoteMany: "{count} questions in the video interview",
  },
  apply: {
    header: "Apply",
    nameLabel: "Full name",
    namePlaceholder: "John Doe",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    phoneLabel: "Phone",
    optional: "optional",
    phonePlaceholder: "+1 555 000-0000",
    submit: "Apply and start the video interview",
    note: "After applying you'll do a short video interview — answer at your own pace.",
  },
  interview: {
    greeting: "Hi, {name}!",
    introDesc:
      "A short video interview of {count} {questions} awaits. Each question gets a video answer from your camera. You can re-record before submitting.",
    qOne: "question",
    qFew: "questions",
    qMany: "questions",
    tip1: "Find a quiet place with good lighting",
    tip2: "Allow access to your camera and microphone",
    tip3: "Answer at your own pace",
    start: "Start interview",
    deniedTitle: "No camera access",
    deniedDesc:
      "Allow camera and microphone access in your browser settings, then try again.",
    retry: "Try again",
    progress: "Question {n} of {m}",
    record: "Record answer",
    stop: "Stop",
    retake: "Re-record",
    submitNext: "Submit and next",
    finish: "Finish interview",
    maxNote: "Up to {min} min per answer. Take your time — you can re-record.",
    uploadError:
      "Couldn't upload the answer. Check your connection and try again.",
    doneTitle: "Thank you, {name}!",
    doneDesc:
      "Your video answers have been sent to the recruiter. We'll be in touch with the outcome.",
    doneDescNoQuestions: "Your application has been received. The recruiter will be in touch.",
  },
};

export const dictionaries = { ru, en };
export type Dictionary = typeof ru;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
