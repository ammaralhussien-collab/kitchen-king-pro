import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { X, Send, Truck, Store, Search, Plus, Minus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface Category { id: string; name: string }
interface MenuItem {
  id: string; name: string; price: number; category_id: string;
  image_url: string | null; is_offer: boolean | null;
  offer_price: number | null; offer_badge: string | null;
}
interface Addon { id: string; name: string; price: number; item_id: string }
interface SelectedItem {
  item: MenuItem; quantity: number; addons: Addon[]; notes: string;
}

type Step = 'order_type' | 'contact' | 'address' | 'items' | 'item_detail' | 'summary' | 'confirmed';

interface Message {
  id: string; from: 'bot' | 'user'; text: string;
  component?: React.ReactNode;
}

const getPrice = (item: MenuItem) => (item.is_offer && item.offer_price) ? item.offer_price : item.price;

export const ChatOrderModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>('order_type');

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [allAddons, setAllAddons] = useState<Addon[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [restaurantId, setRestaurantId] = useState('');

  // Form state
  const [orderType, setOrderType] = useState<'delivery' | 'pickup' | ''>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [driverNotes, setDriverNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Item detail editing
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editAddons, setEditAddons] = useState<Set<string>>(new Set());
  const [editNotes, setEditNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const addMsg = useCallback((from: 'bot' | 'user', text: string, component?: React.ReactNode) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), from, text, component }]);
  }, []);

  // Load menu data
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [catRes, itemRes, addonRes, restRes] = await Promise.all([
        supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
        supabase.from('items').select('*').eq('is_available', true).order('sort_order'),
        supabase.from('item_addons').select('*').eq('is_available', true),
        supabase.from('restaurants').select('id, delivery_fee').limit(1).single(),
      ]);
      if (catRes.data) { setCategories(catRes.data); setActiveCategory(catRes.data[0]?.id || null); }
      if (itemRes.data) setMenuItems(itemRes.data as MenuItem[]);
      if (addonRes.data) setAllAddons(addonRes.data);
      if (restRes.data) { setRestaurantId(restRes.data.id); setDeliveryFee(Number(restRes.data.delivery_fee) || 0); }
    };
    load();
  }, [open]);

  // Init chat
  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setStep('order_type');
    setOrderType(''); setName(''); setPhone(''); setAddress(''); setDriverNotes('');
    setSelectedItems([]); setSearchQuery(''); setOrderId(null);
    setTimeout(() => addMsg('bot', 'مرحباً! 👋 كيف تحب تستلم طلبك؟'), 300);
  }, [open, addMsg]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, step]);

  const handleOrderType = (type: 'delivery' | 'pickup') => {
    setOrderType(type);
    addMsg('user', type === 'delivery' ? '🚗 توصيل' : '🏪 استلام');
    setStep('contact');
    setTimeout(() => addMsg('bot', 'ممتاز! أحتاج اسمك ورقم جوالك'), 400);
  };

  const handleContact = () => {
    if (!name.trim() || !phone.trim()) return;
    addMsg('user', `${name} — ${phone}`);
    if (orderType === 'delivery') {
      setStep('address');
      setTimeout(() => addMsg('bot', 'وين نوصل الطلب؟ اكتب العنوان وأي ملاحظات للسائق'), 400);
    } else {
      setStep('items');
      setTimeout(() => addMsg('bot', 'اختر الأصناف اللي تبيها 🍽️'), 400);
    }
  };

  const handleAddress = () => {
    if (!address.trim()) return;
    addMsg('user', address + (driverNotes ? ` (${driverNotes})` : ''));
    setStep('items');
    setTimeout(() => addMsg('bot', 'اختر الأصناف اللي تبيها 🍽️'), 400);
  };

  const openItemDetail = (item: MenuItem) => {
    setEditingItem(item);
    setEditQty(1);
    setEditAddons(new Set());
    setEditNotes('');
    setStep('item_detail');
  };

  const confirmItemAdd = () => {
    if (!editingItem) return;
    const itemAddons = allAddons
      .filter(a => a.item_id === editingItem.id && editAddons.has(a.id));
    setSelectedItems(prev => [...prev, {
      item: editingItem, quantity: editQty, addons: itemAddons, notes: editNotes,
    }]);
    const addonText = itemAddons.length > 0 ? ` + ${itemAddons.map(a => a.name).join(', ')}` : '';
    addMsg('user', `✅ ${editQty}x ${editingItem.name}${addonText}`);
    setEditingItem(null);
    setStep('items');
  };

  const removeSelectedItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const goToSummary = () => {
    if (selectedItems.length === 0) return;
    setStep('summary');
    addMsg('bot', 'هذا ملخص طلبك 👇');
  };

  const computeSubtotal = () =>
    selectedItems.reduce((sum, si) => {
      const addonTotal = si.addons.reduce((s, a) => s + a.price, 0);
      return sum + (getPrice(si.item) + addonTotal) * si.quantity;
    }, 0);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke('create-chat-order', {
        body: {
          order_type: orderType,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          delivery_address: orderType === 'delivery' ? address.trim() : undefined,
          notes: driverNotes || undefined,
          items: selectedItems.map(si => ({
            item_id: si.item.id,
            quantity: si.quantity,
            addon_ids: si.addons.map(a => a.id),
            notes: si.notes,
          })),
        },
      });
      if (res.error) throw res.error;
      const data = res.data;
      setOrderId(data.order_id);
      setStep('confirmed');
      addMsg('bot', `✅ تم تأكيد الطلب! رقم الطلب: #${data.order_id.slice(0, 8).toUpperCase()}`);
    } catch {
      addMsg('bot', '❌ حدث خطأ في إنشاء الطلب، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(i => {
    const matchesCategory = !activeCategory || i.category_id === activeCategory;
    const matchesSearch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const itemAddonsForEdit = editingItem ? allAddons.filter(a => a.item_id === editingItem.id) : [];

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="flex h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-card sm:h-[600px] sm:rounded-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-display text-lg font-bold">اطلب عبر المحادثة</h3>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.from === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Interactive sections inline */}
            {step === 'order_type' && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => handleOrderType('delivery')} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card p-3 text-sm font-medium hover:border-primary transition-colors">
                  <Truck className="h-4 w-4" /> توصيل
                </button>
                <button onClick={() => handleOrderType('pickup')} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card p-3 text-sm font-medium hover:border-primary transition-colors">
                  <Store className="h-4 w-4" /> استلام
                </button>
              </div>
            )}

            {step === 'contact' && (
              <div className="space-y-2 pt-1">
                <Input placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} />
                <Input placeholder="رقم الجوال" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                <Button onClick={handleContact} className="w-full" size="sm" disabled={!name.trim() || !phone.trim()}>
                  <Send className="mr-1 h-3 w-3" /> متابعة
                </Button>
              </div>
            )}

            {step === 'address' && (
              <div className="space-y-2 pt-1">
                <Input placeholder="العنوان" value={address} onChange={e => setAddress(e.target.value)} />
                <Input placeholder="ملاحظات للسائق (اختياري)" value={driverNotes} onChange={e => setDriverNotes(e.target.value)} />
                <Button onClick={handleAddress} className="w-full" size="sm" disabled={!address.trim()}>
                  <Send className="mr-1 h-3 w-3" /> متابعة
                </Button>
              </div>
            )}

            {step === 'items' && (
              <div className="space-y-3 pt-1">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="ابحث عن صنف..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>

                {/* Category chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        activeCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                      }`}>
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Item cards */}
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {filteredItems.map(item => (
                    <button key={item.id} onClick={() => openItemDetail(item)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left hover:bg-muted/50 transition-colors">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-lg">🍽️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          {item.is_offer && item.offer_badge && (
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-accent-foreground">{item.offer_badge}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-primary">${getPrice(item).toFixed(2)}</span>
                          {item.is_offer && item.offer_price && (
                            <span className="text-[10px] text-muted-foreground line-through">${item.price.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                    </button>
                  ))}
                </div>

                {/* Selected items summary */}
                {selectedItems.length > 0 && (
                  <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <span className="text-xs font-semibold text-primary">الأصناف المختارة ({selectedItems.length})</span>
                    {selectedItems.map((si, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span>{si.quantity}x {si.item.name}</span>
                        <button onClick={() => removeSelectedItem(i)} className="text-destructive hover:underline text-[10px]">حذف</button>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={goToSummary} className="w-full" size="sm" disabled={selectedItems.length === 0}>
                  <Check className="mr-1 h-3 w-3" /> مراجعة الطلب ({selectedItems.length})
                </Button>
              </div>
            )}

            {step === 'item_detail' && editingItem && (
              <div className="space-y-3 rounded-lg border border-border p-3 pt-1">
                <div className="flex items-center gap-3">
                  {editingItem.image_url ? (
                    <img src={editingItem.image_url} alt={editingItem.name} className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-2xl">🍽️</div>
                  )}
                  <div>
                    <h4 className="font-semibold text-sm">{editingItem.name}</h4>
                    <span className="text-sm font-bold text-primary">${getPrice(editingItem).toFixed(2)}</span>
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">الكمية</span>
                  <div className="flex items-center rounded-md border border-border">
                    <button onClick={() => setEditQty(Math.max(1, editQty - 1))} className="px-2 py-1"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-sm font-semibold">{editQty}</span>
                    <button onClick={() => setEditQty(editQty + 1)} className="px-2 py-1"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>

                {/* Addons */}
                {itemAddonsForEdit.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium">إضافات</span>
                    {itemAddonsForEdit.map(addon => (
                      <label key={addon.id} className="flex items-center justify-between rounded-md border border-border p-2 text-xs cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={editAddons.has(addon.id)}
                            onChange={() => setEditAddons(prev => { const n = new Set(prev); n.has(addon.id) ? n.delete(addon.id) : n.add(addon.id); return n; })}
                            className="h-3.5 w-3.5 rounded border-border" />
                          <span>{addon.name}</span>
                        </div>
                        <span className="text-muted-foreground">+${addon.price.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <Input placeholder="ملاحظات خاصة (اختياري)" value={editNotes} onChange={e => setEditNotes(e.target.value)} className="text-xs" />

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditingItem(null); setStep('items'); }}>رجوع</Button>
                  <Button size="sm" className="flex-1" onClick={confirmItemAdd}>
                    <Plus className="mr-1 h-3 w-3" /> أضف — ${((getPrice(editingItem) + itemAddonsForEdit.filter(a => editAddons.has(a.id)).reduce((s, a) => s + a.price, 0)) * editQty).toFixed(2)}
                  </Button>
                </div>
              </div>
            )}

            {step === 'summary' && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <span className="text-xs font-bold">ملخص الطلب</span>
                {selectedItems.map((si, i) => {
                  const addonTotal = si.addons.reduce((s, a) => s + a.price, 0);
                  const line = (getPrice(si.item) + addonTotal) * si.quantity;
                  return (
                    <div key={i} className="flex justify-between text-xs border-b border-border pb-1">
                      <div>
                        <span>{si.quantity}x {si.item.name}</span>
                        {si.addons.length > 0 && <span className="text-muted-foreground"> + {si.addons.map(a => a.name).join(', ')}</span>}
                      </div>
                      <span className="font-semibold">${line.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span>${computeSubtotal().toFixed(2)}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">رسوم التوصيل</span>
                    <span>${deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
                  <span>الإجمالي</span>
                  <span className="text-primary">${(computeSubtotal() + (orderType === 'delivery' ? deliveryFee : 0)).toFixed(2)}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setStep('items')}>تعديل</Button>
                  <Button size="sm" className="flex-1" onClick={handleConfirm} disabled={loading}>
                    {loading ? 'جاري...' : '✅ تأكيد الطلب'}
                  </Button>
                </div>
              </div>
            )}

            {step === 'confirmed' && orderId && (
              <div className="pt-1">
                <Button onClick={() => { onClose(); navigate(`/order/${orderId}`); }} className="w-full" size="sm">
                  تتبع الطلب 📍
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChatOrderModal;
