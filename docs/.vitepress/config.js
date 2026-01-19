import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Cairn',
  description: 'Persistent memory for AI agents and developers',
  base: '/cairn/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'API', link: '/api/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Extension', link: '/extension/' }
    ],

    sidebar: {
      '/': [
        {
          text: 'Overview',
          items: [
            { text: 'Introduction', link: '/' },
            { text: 'Quick Start', link: '/#quick-start' },
            { text: 'Key Concepts', link: '/#key-concepts' },
            { text: 'Workflows', link: '/#workflows' },
            { text: 'Integration', link: '/#integration' },
            { text: 'Best Practices', link: '/#best-practices' },
            { text: 'Troubleshooting', link: '/#troubleshooting' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'Core API',
          items: [
            { text: 'Overview', link: '/api/' }
          ]
        }
      ],
      '/cli/': [
        {
          text: 'CLI Tool',
          items: [
            { text: 'Overview', link: '/cli/' }
          ]
        }
      ],
      '/extension/': [
        {
          text: 'VS Code Extension',
          items: [
            { text: 'Overview', link: '/extension/' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/valpet/cairn' }
    ]
  }
})