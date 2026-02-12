import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import ChatOrderModal from './ChatOrderModal';

const ChatOrderButton = () => {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm">{t('chat.orderViaChat')}</span>
      </motion.button>
      <ChatOrderModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default ChatOrderButton;
