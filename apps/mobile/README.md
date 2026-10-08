# Mobile application (planned)

Reserve this directory for React Native + Expo after the web/API foundation.
No native mobile app is implemented yet.

Reuse packages/contracts, the /v1 API, validation and business rules. Build native
screens rather than copying HTML/CSS. Introduce a reviewed native session flow,
OS secure credential storage, app-background locking and explicit push opt-in.
Do not embed cookie tokens in AsyncStorage or copy web secrets into the mobile app.
Web and native clients will need separate authentication transports. Native
clients cannot simply bypass the current web Origin/CSRF protections.
