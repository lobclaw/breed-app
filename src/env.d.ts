/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

declare module '@/uni_modules/uni-id-pages/init.js' {
  const init: () => void
  export default init
}

declare module '@/uni_modules/uni-id-pages/common/store.js' {
  export const mutations: {
    logout: () => void
  }
}
