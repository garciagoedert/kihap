const API_URL = 'http://localhost:3000/api';

async function fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Failed after retries');
}

export const api = {
  units: {
    async getAll() {
      const response = await fetchWithRetry(`${API_URL}/units`);
      return response.json();
    },
    async add(unit: any) {
      const response = await fetchWithRetry(`${API_URL}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unit)
      });
      return response.json();
    }
  },

  students: {
    async getAll() {
      const response = await fetchWithRetry(`${API_URL}/students`);
      return response.json();
    },
    async add(student: any) {
      const response = await fetchWithRetry(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      return response.json();
    }
  },

  attendance: {
    async getAll() {
      const response = await fetchWithRetry(`${API_URL}/attendance`);
      return response.json();
    },
    async add(attendance: any) {
      const response = await fetchWithRetry(`${API_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendance)
      });
      return response.json();
    }
  },

  users: {
    async getAll() {
      const response = await fetchWithRetry(`${API_URL}/users`);
      return response.json();
    },
    async add(user: any) {
      const response = await fetchWithRetry(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      return response.json();
    }
  }
};