import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: 'src',
  title: "Ficha de Treino",
  description: "Plano de Treino Abrangente para Hipertrofia e Força",
  themeConfig: {
    sidebar: [
      {
        text: 'Treinamento',
        items: [
          { text: 'Segunda', link: 'days/treino-1' },
          { text: 'Terça', link: 'days/treino-2' },
          { text: 'Quarta', link: 'days/treino-3' },
          { text: 'Sexta', link: 'days/treino-4' },
          { text: 'Sábado', link: 'days/treino-5' },
        ]
      }
    ],
  }
})
