Deployment notes

This file was created by the automated deploy script.

Services:
- frontend: exposed on host port 3000
- backend: exposed on host port 3001

Started with: docker-compose up --build
Health endpoints checked:
- http://localhost:3000/health
- http://localhost:3001/health
