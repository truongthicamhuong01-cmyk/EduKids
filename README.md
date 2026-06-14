push code lên github:
git add .
git commit -m "{reason}"
git push

deploy code lên firebase hosting:
cd frontend
npm run build
firebase deploy --only hosting
