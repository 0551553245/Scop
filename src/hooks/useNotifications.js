import { useState, useEffect } from 'react'
import { supabaseOwner } from '../lib/supabase'
import { useOwnerAuth } from '../context/OwnerAuthContext'
import { useSubscription } from './useSubscription'

export function useNotifications() {
  const { profile } = useOwnerAuth()
  const { subscription } = useSubscription()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!profile?.id || !subscription?.plan) return

    fetchNotifications()

    const channelName = `owner-notifications-${profile.id}`
    supabaseOwner.removeChannel(supabaseOwner.channel(channelName))

    try {
      const ch = supabaseOwner
        .channel(channelName)
        // No row-level filter: notifications are platform-wide; RLS scopes by target plan on read
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        }, () => fetchNotifications())
        .subscribe()
      return () => supabaseOwner.removeChannel(ch)
    } catch (err) {
      console.error('Notification channel error:', err)
    }
  }, [profile?.id, subscription?.plan])

  async function fetchNotifications() {
    const plan = subscription?.plan || 'trial'
    const { data } = await supabaseOwner
      .from('notifications')
      .select('id, title, title_ar, message, message_ar, target, created_at')
      .or(`target.eq.all,target.eq.${plan}`)
      .gte('created_at', profile.created_at)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
    setUnreadCount((data || []).length)
  }

  function markAllRead() {
    setUnreadCount(0)
  }

  return { notifications, unreadCount, open, setOpen, markAllRead }
}
