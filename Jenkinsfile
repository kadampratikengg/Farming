pipeline {
  agent any

  environment {
    REACT_APP_API_URL = 'http://your-api-url'
  }

  stages {
    stage('Checkout') {
      steps {
        git 'https://github.com/yourname/AppointmentApp.git'
      }
    }

    stage('Build Frontend') {
      steps {
        dir('client') {
          sh 'npm install'
          sh 'npm run build'
        }
      }
    }

    stage('Build Backend') {
      steps {
        dir('server') {
          sh 'npm install'
        }
      }
    }

    stage('Docker Build & Push') {
      steps {
        sh 'docker build -t yourname/frontend ./client'
        sh 'docker build -t yourname/backend ./server'
        sh 'docker tag yourname/frontend your-dockerhub/frontend'
        sh 'docker tag yourname/backend your-dockerhub/backend'
        sh 'docker push your-dockerhub/frontend'
        sh 'docker push your-dockerhub/backend'
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        sh 'kubectl apply -f k8s/frontend-deployment.yaml'
        sh 'kubectl apply -f k8s/backend-deployment.yaml'
      }
    }
  }
}
