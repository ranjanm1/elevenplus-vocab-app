import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 5 },   // ramp up to 5 users
    { duration: '3m', target: 5 },   // stay at 5 users
    { duration: '2m', target: 20 },  // ramp up to 20 users
    { duration: '3m', target: 20 },  // stay at 20 users
    { duration: '2m', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const baseUrl = __ENV.BASE_URL;

  const res = http.get(baseUrl);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}