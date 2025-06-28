import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000',
});

export function login(email, password) {
  return api.post('/login', { email, password });
}
export function signup(email, password) {
  return api.post('/signup', { email, password });
}