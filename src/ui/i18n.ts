export interface Translations {
  prechat: {
    title: string
    description: string
    name: string
    namePlaceholder: string
    email: string
    emailPlaceholder: string
    start: string
    loading: string
    privacyPrefix: string
    privacyLink: string
  }
  chat: {
    placeholder: string
    closed: string
    reopen: string
    newConversation: string
    attachFile: string
    uploading: string
    fileTooLarge: string
    download: string
    emptyTitle: string
    emptyDescription: string
    recordAudio: string
    cancelAudio: string
    sendAudio: string
    recordingHint: string
    audioPermissionDenied: string
    audioCorrupted: string
  }
  conversations: {
    title: string
    newConversation: string
    empty: string
    open: string
    closed: string
    noMessages: string
  }
  home: {
    helloFallback: string
    helloName: string
    howCanWeHelp: string
    startConversation: string
    responseInUnderMin: string
    responseInUnderMins: string
    responseInUnderHour: string
    typicallyReplies: string
    teamOnline: string
    teamOffline: string
    agentsOnline: string
    agentOnline: string
    continueWhereLeftOff: string
    recommendedArticles: string
    seeAll: string
    searchHelpPlaceholder: string
  }
  tabs: {
    home: string
    messages: string
    help: string
  }
  messages: {
    title: string
    subtitleCounts: string
    inProgress: string
    new: string
    completed: string
    statusOpen: string
    statusClosed: string
    empty: string
  }
  help: {
    title: string
    subtitle: string
    searchPlaceholder: string
    popular: string
    noArticles: string
    noResults: string
  }
  article: {
    minRead: string
    minsRead: string
    feedbackQuestion: string
    feedbackYes: string
    feedbackNo: string
    feedbackThanks: string
    backToHelp: string
  }
}

const pt: Translations = {
  prechat: {
    title: 'Iniciar conversa',
    description: 'Preencha os dados abaixo para iniciar o atendimento.',
    name: 'Nome',
    namePlaceholder: 'Seu nome',
    email: 'E-mail',
    emailPlaceholder: 'seu@email.com',
    start: 'Iniciar conversa',
    loading: 'Iniciando...',
    privacyPrefix: 'Ao enviar, você concorda com nossa',
    privacyLink: 'Política de Privacidade',
  },
  chat: {
    placeholder: 'Digite uma mensagem...',
    closed: 'Esta conversa foi encerrada.',
    reopen: 'Reabrir conversa',
    newConversation: 'Nova conversa',
    attachFile: 'Anexar arquivo',
    uploading: 'Enviando...',
    fileTooLarge: 'Arquivo muito grande (máx. 25MB)',
    download: 'Baixar',
    emptyTitle: 'Comece a conversar',
    emptyDescription: 'Mande sua primeira mensagem — costumamos responder rápido.',
    recordAudio: 'Gravar áudio',
    cancelAudio: 'Cancelar gravação',
    sendAudio: 'Enviar áudio',
    recordingHint: 'Toque em ▸ para enviar',
    audioPermissionDenied: 'Permissão de microfone negada.',
    audioCorrupted: 'Falha ao gravar áudio. Tente novamente.',
  },
  conversations: {
    title: 'Atendimento',
    newConversation: 'Nova conversa',
    empty: 'Nenhuma conversa encontrada.',
    open: 'Aberta',
    closed: 'Fechada',
    noMessages: 'Nenhuma mensagem ainda',
  },
  home: {
    helloFallback: 'Olá',
    helloName: 'Olá, {{name}}',
    howCanWeHelp: 'Como podemos ajudar?',
    startConversation: 'Iniciar uma conversa',
    responseInUnderMin: 'Resposta em geral em menos de 1 min',
    responseInUnderMins: 'Resposta em geral em menos de {{mins}} min',
    responseInUnderHour: 'Resposta em geral em menos de 1 hora',
    typicallyReplies: 'Costumamos responder rápido',
    teamOnline: 'Time online',
    teamOffline: 'Responderemos em breve',
    agentsOnline: '{{count}} agentes online',
    agentOnline: '1 agente online',
    continueWhereLeftOff: 'Continue de onde parou',
    recommendedArticles: 'Artigos recomendados',
    seeAll: 'Ver tudo',
    searchHelpPlaceholder: 'Buscar ajuda…',
  },
  tabs: {
    home: 'Início',
    messages: 'Mensagens',
    help: 'Ajuda',
  },
  messages: {
    title: 'Mensagens',
    subtitleCounts: '{{open}} aberta(s) · {{closed}} concluída(s)',
    inProgress: 'Em atendimento',
    new: '+ Nova',
    completed: 'Concluídas',
    statusOpen: 'Em atendimento',
    statusClosed: 'Concluída',
    empty: 'Você ainda não tem conversas.',
  },
  help: {
    title: 'Central de ajuda',
    subtitle: 'Pesquise artigos ou navegue por categoria',
    searchPlaceholder: 'Buscar artigos…',
    popular: 'Mais lidos',
    noArticles: 'Nenhum artigo publicado ainda.',
    noResults: 'Nenhum artigo encontrado.',
  },
  article: {
    minRead: '1 min de leitura',
    minsRead: '{{mins}} min de leitura',
    feedbackQuestion: 'Esse artigo foi útil?',
    feedbackYes: 'Sim',
    feedbackNo: 'Não',
    feedbackThanks: 'Obrigado pelo feedback!',
    backToHelp: 'Voltar',
  },
}

const en: Translations = {
  prechat: {
    title: 'Start a conversation',
    description: 'Fill in the details below to start chatting.',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'you@email.com',
    start: 'Start conversation',
    loading: 'Starting...',
    privacyPrefix: 'By sending, you agree to our',
    privacyLink: 'Privacy Policy',
  },
  chat: {
    placeholder: 'Type a message...',
    closed: 'This conversation has been closed.',
    reopen: 'Reopen conversation',
    newConversation: 'New conversation',
    attachFile: 'Attach file',
    uploading: 'Uploading...',
    fileTooLarge: 'File too large (max 25MB)',
    download: 'Download',
    emptyTitle: 'Start the conversation',
    emptyDescription: 'Send your first message — we usually reply fast.',
    recordAudio: 'Record audio',
    cancelAudio: 'Cancel recording',
    sendAudio: 'Send audio',
    recordingHint: 'Tap ▸ to send',
    audioPermissionDenied: 'Microphone permission denied.',
    audioCorrupted: 'Recording failed. Please try again.',
  },
  conversations: {
    title: 'Support',
    newConversation: 'New conversation',
    empty: 'No conversations found.',
    open: 'Open',
    closed: 'Closed',
    noMessages: 'No messages yet',
  },
  home: {
    helloFallback: 'Hello',
    helloName: 'Hi, {{name}}',
    howCanWeHelp: 'How can we help?',
    startConversation: 'Start a conversation',
    responseInUnderMin: 'Typically replies in under 1 min',
    responseInUnderMins: 'Typically replies in under {{mins}} min',
    responseInUnderHour: 'Typically replies in under 1 hour',
    typicallyReplies: 'We usually reply fast',
    teamOnline: 'Team online',
    teamOffline: "We'll reply soon",
    agentsOnline: '{{count}} agents online',
    agentOnline: '1 agent online',
    continueWhereLeftOff: 'Pick up where you left off',
    recommendedArticles: 'Recommended articles',
    seeAll: 'See all',
    searchHelpPlaceholder: 'Search help…',
  },
  tabs: {
    home: 'Home',
    messages: 'Messages',
    help: 'Help',
  },
  messages: {
    title: 'Messages',
    subtitleCounts: '{{open}} open · {{closed}} closed',
    inProgress: 'In progress',
    new: '+ New',
    completed: 'Closed',
    statusOpen: 'In progress',
    statusClosed: 'Closed',
    empty: "You don't have any conversations yet.",
  },
  help: {
    title: 'Help center',
    subtitle: 'Search articles or browse by category',
    searchPlaceholder: 'Search articles…',
    popular: 'Most read',
    noArticles: 'No published articles yet.',
    noResults: 'No articles found.',
  },
  article: {
    minRead: '1 min read',
    minsRead: '{{mins}} min read',
    feedbackQuestion: 'Was this article helpful?',
    feedbackYes: 'Yes',
    feedbackNo: 'No',
    feedbackThanks: 'Thanks for the feedback!',
    backToHelp: 'Back',
  },
}

const es: Translations = {
  prechat: {
    title: 'Iniciar conversación',
    description: 'Complete los datos a continuación para iniciar la atención.',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre',
    email: 'Correo electrónico',
    emailPlaceholder: 'tu@email.com',
    start: 'Iniciar conversación',
    loading: 'Iniciando...',
    privacyPrefix: 'Al enviar, aceptas nuestra',
    privacyLink: 'Política de Privacidad',
  },
  chat: {
    placeholder: 'Escribe un mensaje...',
    closed: 'Esta conversación ha sido cerrada.',
    reopen: 'Reabrir conversación',
    newConversation: 'Nueva conversación',
    attachFile: 'Adjuntar archivo',
    uploading: 'Subiendo...',
    fileTooLarge: 'Archivo demasiado grande (máx. 25MB)',
    download: 'Descargar',
    emptyTitle: 'Empieza la conversación',
    emptyDescription: 'Envía tu primer mensaje — solemos responder rápido.',
    recordAudio: 'Grabar audio',
    cancelAudio: 'Cancelar grabación',
    sendAudio: 'Enviar audio',
    recordingHint: 'Toca ▸ para enviar',
    audioPermissionDenied: 'Permiso de micrófono denegado.',
    audioCorrupted: 'Error al grabar audio. Intenta de nuevo.',
  },
  conversations: {
    title: 'Atención',
    newConversation: 'Nueva conversación',
    empty: 'No se encontraron conversaciones.',
    open: 'Abierta',
    closed: 'Cerrada',
    noMessages: 'Sin mensajes aún',
  },
  home: {
    helloFallback: 'Hola',
    helloName: 'Hola, {{name}}',
    howCanWeHelp: '¿Cómo podemos ayudar?',
    startConversation: 'Iniciar una conversación',
    responseInUnderMin: 'Solemos responder en menos de 1 min',
    responseInUnderMins: 'Solemos responder en menos de {{mins}} min',
    responseInUnderHour: 'Solemos responder en menos de 1 hora',
    typicallyReplies: 'Solemos responder rápido',
    teamOnline: 'Equipo en línea',
    teamOffline: 'Responderemos pronto',
    agentsOnline: '{{count}} agentes en línea',
    agentOnline: '1 agente en línea',
    continueWhereLeftOff: 'Continúa donde lo dejaste',
    recommendedArticles: 'Artículos recomendados',
    seeAll: 'Ver todo',
    searchHelpPlaceholder: 'Buscar ayuda…',
  },
  tabs: {
    home: 'Inicio',
    messages: 'Mensajes',
    help: 'Ayuda',
  },
  messages: {
    title: 'Mensajes',
    subtitleCounts: '{{open}} abierta(s) · {{closed}} cerrada(s)',
    inProgress: 'En atención',
    new: '+ Nueva',
    completed: 'Cerradas',
    statusOpen: 'En atención',
    statusClosed: 'Cerrada',
    empty: 'Aún no tienes conversaciones.',
  },
  help: {
    title: 'Centro de ayuda',
    subtitle: 'Busca artículos o navega por categoría',
    searchPlaceholder: 'Buscar artículos…',
    popular: 'Más leídos',
    noArticles: 'Aún no hay artículos publicados.',
    noResults: 'No se encontraron artículos.',
  },
  article: {
    minRead: '1 min de lectura',
    minsRead: '{{mins}} min de lectura',
    feedbackQuestion: '¿Te resultó útil este artículo?',
    feedbackYes: 'Sí',
    feedbackNo: 'No',
    feedbackThanks: '¡Gracias por tu opinión!',
    backToHelp: 'Volver',
  },
}

const locales: Record<string, Translations> = { pt, en, es }

export function getTranslations(locale: string): Translations {
  return locales[locale] || locales['pt']
}

export function formatT(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''))
}
