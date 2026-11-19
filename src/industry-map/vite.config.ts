import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins:[react()], base:'./', build:{ chunkSizeWarningLimit:2500,
  rollupOptions:{ output:{ manualChunks(id){ if(id.includes('echarts-gl')||id.includes('claygl')) return 'echarts-gl'; if(id.includes('/echarts/')||id.includes('zrender')) return 'echarts'; if(id.includes('@antv')) return 'g6'; if(id.includes('react')) return 'react' } } } } })
