import { spawn } from 'node:child_process'

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const detached = process.platform !== 'win32'
const services = [
  spawn(command, ['run', 'dev:api'], { stdio: 'inherit', detached }),
  spawn(command, ['run', 'dev:web'], { stdio: 'inherit', detached }),
]

let stopping = false

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const service of services) {
    if (service.exitCode !== null || !service.pid) continue
    try {
      if (detached) process.kill(-service.pid, 'SIGTERM')
      else service.kill('SIGTERM')
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error)
    }
  }
  process.exitCode = exitCode
}

for (const service of services) {
  service.on('error', (error) => {
    console.error(error)
    stop(1)
  })
  service.on('exit', (code) => stop(code ?? 1))
}

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
