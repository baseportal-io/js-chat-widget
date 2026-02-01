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
    attachFile: string
    uploading: string
    fileTooLarge: string
    download: string
  }
  conversations: {
    title: string
    newConversation: string
    empty: string
    open: string
    closed: string
    noMessages: string
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
    attachFile: 'Anexar arquivo',
    uploading: 'Enviando...',
    fileTooLarge: 'Arquivo muito grande (máx. 25MB)',
    download: 'Baixar',
  },
  conversations: {
    title: 'Atendimento',
    newConversation: 'Nova conversa',
    empty: 'Nenhuma conversa encontrada.',
    open: 'Aberta',
    closed: 'Fechada',
    noMessages: 'Nenhuma mensagem ainda',
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
    attachFile: 'Attach file',
    uploading: 'Uploading...',
    fileTooLarge: 'File too large (max 25MB)',
    download: 'Download',
  },
  conversations: {
    title: 'Support',
    newConversation: 'New conversation',
    empty: 'No conversations found.',
    open: 'Open',
    closed: 'Closed',
    noMessages: 'No messages yet',
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
    attachFile: 'Adjuntar archivo',
    uploading: 'Subiendo...',
    fileTooLarge: 'Archivo demasiado grande (máx. 25MB)',
    download: 'Descargar',
  },
  conversations: {
    title: 'Atención',
    newConversation: 'Nueva conversación',
    empty: 'No se encontraron conversaciones.',
    open: 'Abierta',
    closed: 'Cerrada',
    noMessages: 'Sin mensajes aún',
  },
}

const locales: Record<string, Translations> = { pt, en, es }

export function getTranslations(locale: string): Translations {
  return locales[locale] || locales['pt']
}
