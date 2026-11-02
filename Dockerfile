# AidRelay — static app served by the stdlib-only server.py.
# No dependencies to install: Python's standard library is the whole stack.
FROM python:3.12-slim

WORKDIR /app
COPY . .

EXPOSE 8772
CMD ["python3", "server.py"]
