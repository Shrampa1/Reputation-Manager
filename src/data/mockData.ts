import type {
  NAPConsistency,
  GeoGridData,
  Conversation,
} from '@/types';

export const napConsistency: NAPConsistency[] = [
  {
    platform: 'Google Business',
    icon: 'google',
    name: 'Premier Plumbing Solutions',
    address: '142 Oak Street, Austin, TX 78701',
    phone: '(512) 555-0142',
    status: 'consistent',
  },
  {
    platform: 'Apple Maps',
    icon: 'apple',
    name: 'Premier Plumbing Solutions',
    address: '142 Oak Street, Austin, TX 78701',
    phone: '(512) 555-0142',
    status: 'consistent',
  },
  {
    platform: 'Bing Places',
    icon: 'bing',
    name: 'Premier Plumbing Solutions',
    address: '142 Oak St, Austin, TX 78701',
    phone: '(512) 555-0142',
    status: 'warning',
  },
];

export const geoGridData: GeoGridData = {
  query: 'plumber near me',
  cells: [
    [
      { id: 'g-1-1', rank: 1, label: 'Downtown' },
      { id: 'g-1-2', rank: 3, label: 'East Austin' },
      { id: 'g-1-3', rank: 7, label: 'Hyde Park' },
    ],
    [
      { id: 'g-2-1', rank: 2, label: 'South Congress' },
      { id: 'g-2-2', rank: 1, label: 'Zilker' },
      { id: 'g-2-3', rank: 12, label: 'Mueller' },
    ],
    [
      { id: 'g-3-1', rank: 5, label: 'Barton Hills' },
      { id: 'g-3-2', rank: 8, label: 'Cherrywood' },
      { id: 'g-3-3', rank: 4, label: 'Travis Heights' },
    ],
  ],
};

export const conversations: Conversation[] = [
  {
    id: 'conv-1',
    name: 'Karen Williams',
    channel: 'web_chat',
    lastMessage: 'Hi, do you offer emergency plumbing services on weekends?',
    timestamp: '10:42 AM',
    unread: 2,
    messages: [
      { id: 'm-1', from: 'lead', text: 'Hi, do you offer emergency plumbing services on weekends?', time: '10:40 AM' },
      { id: 'm-2', from: 'lead', text: 'I have a burst pipe situation', time: '10:42 AM' },
    ],
  },
  {
    id: 'conv-2',
    name: 'Tom Bradley',
    channel: 'sms',
    lastMessage: 'Thanks for the quick response! What are your rates?',
    timestamp: '9:15 AM',
    unread: 1,
    messages: [
      { id: 'm-3', from: 'lead', text: 'Do you do water heater installations?', time: '9:10 AM' },
      { id: 'm-4', from: 'owner', text: 'Hi Tom! Yes, we specialize in water heater installation and replacement. What type of heater do you currently have?', time: '9:12 AM' },
      { id: 'm-5', from: 'lead', text: 'Thanks for the quick response! What are your rates?', time: '9:15 AM' },
    ],
  },
  {
    id: 'conv-3',
    name: 'Rachel Green',
    channel: 'messenger',
    lastMessage: 'Perfect, I\'ll book for Tuesday then.',
    timestamp: 'Yesterday',
    unread: 0,
    messages: [
      { id: 'm-6', from: 'lead', text: 'I need to schedule a drain cleaning', time: 'Yesterday 3:20 PM' },
      { id: 'm-7', from: 'owner', text: 'We have openings Tuesday at 10 AM or Thursday at 2 PM. Which works for you?', time: 'Yesterday 3:25 PM' },
      { id: 'm-8', from: 'lead', text: 'Perfect, I\'ll book for Tuesday then.', time: 'Yesterday 3:30 PM' },
    ],
  },
  {
    id: 'conv-4',
    name: 'Kevin Martinez',
    channel: 'web_chat',
    lastMessage: 'Can I get a quote for a kitchen repipe?',
    timestamp: 'Yesterday',
    unread: 0,
    messages: [
      { id: 'm-9', from: 'lead', text: 'Can I get a quote for a kitchen repipe?', time: 'Yesterday 1:00 PM' },
      { id: 'm-10', from: 'owner', text: 'Absolutely! I\'ll need a few details. Is this a full kitchen renovation or just replacing old pipes?', time: 'Yesterday 1:05 PM' },
    ],
  },
];

export const leadStages: { key: string; label: string }[] = [
  { key: 'new_lead', label: 'New Lead' },
  { key: 'quote_sent', label: 'Quote Sent' },
  { key: 'job_booked', label: 'Job Booked' },
  { key: 'completed', label: 'Completed' },
  { key: 'review_requested', label: 'Review Requested' },
];
