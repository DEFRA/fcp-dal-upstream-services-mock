const health = {
  plugin: {
    name: 'health',
    register: (server, _options) => {
      server.route({
        method: 'GET',
        path: '/health',
        handler: (_request, h) => h.response({ message: 'success' })
      })
    }
  }
}

export { health }
