push code lên github:
git add .
git commit -m "{reason}"
git push origin main

push code lên firebase hosting:
cd frontend
npm run build
firebase deploy --only hosting
