FROM node:22-alpine
WORKDIR /app

# Dienst-Module. Beim Hinzufügen weiterer Dateien HIER ergänzen — sonst startet
# der Container nicht: der Import schlägt fehl und Coolify meldet 503.
COPY server.mjs push.mjs kunden.mjs ./

# Oberfläche der Anfragen-App, wird vom Server unter /app/ ausgeliefert
COPY app ./app

EXPOSE 8080
CMD ["node", "server.mjs"]
