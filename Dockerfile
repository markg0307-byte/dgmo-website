FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/README.md \
          /usr/share/nginx/html/nginx.conf
EXPOSE 80
