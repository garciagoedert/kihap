---
description: Deploy the application to Firebase
---
# Deploy to Firebase

This workflow deploys the application to Firebase Hosting.

1.  **Login to Firebase** (if not already logged in):
    ```bash
    firebase login
    ```

2.  **Deploy**:
    ```bash
    firebase deploy
    ```

    If you only want to deploy specific features (e.g., only hosting or only functions):
    ```bash
    firebase deploy --only hosting
    ```
    or
    ```bash
    firebase deploy --only functions
    ```
