# Pacmon Deployment Guide

This guide will walk you through deploying your Pacmon game to Vercel and integrating it with Farcaster.

## Prerequisites

- GitHub account
- Vercel account (free tier is sufficient)
- Farcaster account with Developer mode enabled

## Step 1: Prepare Your Code for GitHub

1. **Initialize Git repository** (if not already done):
```bash
cd pacmon-game
git init
git add .
git commit -m "Initial commit: Pacmon game with Farcaster integration"
```

2. **Create a new repository on GitHub**:
   - Go to [GitHub](https://github.com)
   - Click "New repository"
   - Name it `pacmon-game` or your preferred name
   - Make it public or private (your choice)
   - Don't initialize with README (we already have one)

3. **Push your code to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/pacmon-game.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Vercel

1. **Connect GitHub to Vercel**:
   - Go to [Vercel](https://vercel.com)
   - Sign up/login with your GitHub account
   - Click "New Project"
   - Import your `pacmon-game` repository

2. **Configure deployment settings**:
   - **Framework Preset**: Next.js (should be auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

3. **Set environment variables**:
   - In Vercel dashboard, go to your project settings
   - Navigate to "Environment Variables"
   - Add: `NEXT_PUBLIC_URL` = `https://your-app-name.vercel.app`
   - Replace `your-app-name` with your actual Vercel app URL

4. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete (usually 1-2 minutes)
   - Your app will be available at `https://your-app-name.vercel.app`

## Step 3: Test Your Deployment

1. **Visit your deployed app**:
   - Go to your Vercel URL
   - You should see the message "No farcaster SDK found, please use this miniapp in the farcaster app"
   - This is expected behavior for the production version

2. **Verify frame metadata**:
   - Check `https://your-app-name.vercel.app/.well-known/farcaster.json`
   - Should return JSON with your app configuration

## Step 4: Integrate with Farcaster

### Enable Developer Mode

1. **Open Farcaster app**
2. **Go to Settings > Advanced**
3. **Scroll down and enable "Developer mode"**

### Add Your Domain

1. **In Farcaster, go to Settings > Developer > Domains**
2. **Enter your domain**: `your-app-name.vercel.app`
3. **Click "Generate Domain Manifest"**
4. **Wait for verification** (may take a few minutes)

### Test in Farcaster

1. **Create a test cast** with your app URL
2. **The cast should show your feed image and "Play Pacmon" button**
3. **Tap the button to launch your mini-app**
4. **The game should load and be playable within Farcaster**

## Step 5: Farcaster Embed Tool Testing

For testing during development, you can use the Farcaster Embed Tool:

1. **Make your local app accessible remotely**:
```bash
# Install cloudflared (macOS)
brew install cloudflared

# Or install ngrok
npm install -g ngrok
```

2. **Create a tunnel**:
```bash
# Using cloudflared
cloudflared tunnel --url http://localhost:3000

# Or using ngrok
ngrok http 3000
```

3. **Test with Farcaster Embed Tool**:
   - Go to the [Farcaster Embed Tool](https://embed.farcaster.xyz/)
   - Enter your tunnel URL
   - Preview how your mini-app will appear in Farcaster

## Troubleshooting

### Common Issues

1. **"No farcaster SDK found" message**:
   - This is normal when accessing the app directly via browser
   - The app will work correctly when launched from within Farcaster

2. **Images not loading**:
   - Ensure all images are in the `public/images/` directory
   - Check that image paths in your code use `/images/` (not `./images/`)

3. **Environment variable issues**:
   - Make sure `NEXT_PUBLIC_URL` is set correctly in Vercel
   - Redeploy after changing environment variables

4. **Farcaster domain verification fails**:
   - Ensure your domain is accessible and returns the correct farcaster.json
   - Wait a few minutes and try again
   - Check that your app is properly deployed and not showing errors

### Debugging Steps

1. **Check Vercel deployment logs**:
   - Go to your Vercel dashboard
   - Click on your deployment
   - Check the "Functions" and "Build Logs" tabs for errors

2. **Verify farcaster.json endpoint**:
   - Visit `https://your-app.vercel.app/.well-known/farcaster.json`
   - Should return valid JSON with your app configuration

3. **Test frame metadata**:
   - Use tools like [Frame Validator](https://warpcast.com/~/developers/frames) to test your frame

## Updates and Maintenance

### Updating Your App

1. **Make changes to your code**
2. **Commit and push to GitHub**:
```bash
git add .
git commit -m "Update: description of changes"
git push origin main
```
3. **Vercel will automatically redeploy** (if auto-deployment is enabled)

### Monitoring

- **Vercel Analytics**: Monitor app performance and usage
- **Farcaster Developer Tools**: Track mini-app engagement
- **GitHub Issues**: Track bugs and feature requests

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to GitHub
2. **CORS**: The app is configured to work within Farcaster's iframe
3. **Rate Limiting**: Consider implementing rate limiting for production apps
4. **Content Security Policy**: Review and adjust CSP headers if needed

## Next Steps

After successful deployment, consider:

1. **Adding analytics** to track user engagement
2. **Implementing leaderboards** using Farcaster user data
3. **Adding social features** like sharing scores
4. **Creating multiple levels** or game modes
5. **Adding sound effects** and animations
6. **Implementing wallet integration** for rewards or NFTs

## Support

If you encounter issues:

1. Check the [Farcaster Developer Documentation](https://docs.farcaster.xyz/)
2. Review [Vercel Documentation](https://vercel.com/docs)
3. Check GitHub Issues for similar problems
4. Contact the development team

---

🎉 Congratulations! Your Pacmon game should now be live and playable in Farcaster!

