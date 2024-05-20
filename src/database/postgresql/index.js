import pg from 'pg'
import { UniqueConstraintError, RequestSyntaxError } from './errors.js'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg
const pool = new Pool()

pool.connect().then(() => {
  console.log('[database] Successfully connected to PostgreSQL database')
}).catch(err => {
  console.error('[database]', err)
  process.exit(-1)
})

const getErrorType = (code) => {
  switch (code) {
    case '23505':
      return new UniqueConstraintError()
    case '42601':
      return new RequestSyntaxError()
    default:
      return new Error('Unknown error')
  }
}

const query = async (text, params, callback) => {
  return await pool.query(text, params, callback).catch(e => {
    throw getErrorType(e.code)
  })
}

const queryTransaction = async (client, text, params, callback) => {
  return await client.query(text, params, callback).catch(e => {
    throw getErrorType(e.code)
  })
}

const getClient = () => pool.connect()

export default {
  query,
  queryTransaction,
  getClient
}
