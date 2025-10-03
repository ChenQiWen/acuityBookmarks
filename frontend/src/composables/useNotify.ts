import { notify, notifyError, notifyInfo, notifySuccess, notifyWarning } from '@/utils/notifications'

export function useNotify() {
  return {
    notify,
    notifySuccess,
    notifyInfo,
    notifyWarning,
    notifyError,
  }
}
