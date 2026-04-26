# Green Building Project

> [!IMPORTANT]
> **Repository Migration Notice:** This repository is the new official home for the Green Building project. Due to a configuration error in the previous repository's .gitignore that led to a security vulnerability, the original history has been archived privately. This repo contains the sanitized, final codebase with fresh security configurations.

## Sanitized Commit History

| Date & Time | Commit Hash | Message |
| :--- | :--- | :--- |
| 2026-04-26 19:32 | 08516ad888a6e701196050f350402a9b3caa5d5a | final code review |
| 2026-04-26 19:23 | 01584bdfd69725f419acb4bbaebaa017a90ee59b | creds to .env |
| 2026-04-26 19:05 | a265e40cc2ab3dae2ca6ffdf0aaa9dc9e63f3c22 | feat: add Badge component and integrate into AdminDashboard |
| 2026-04-26 19:03 | 39f9bbb1361ec193b57ccf43ae53534adb05af8a | feat: implement admin API endpoints for user management and activity history with JWT middleware and dashboard integration |
| 2026-04-26 18:46 | 77d98540b67bc98338185fd0e6026f18512a77a9 | refactor: remove profile and account management features from frontend and backend |
| 2026-04-26 18:42 | a0f49b5d9e045b856f29f31679a28481b4dc9b8a | fix: update JWT signing method validation to use HMAC and remove unused os import |
| 2026-04-26 18:40 | 7158071c611a1184ef073fd462e4be02526f6898 | feat: implement logging for JWT authentication errors and restrict signing method to HS256 |
| 2026-04-26 18:36 | 95615d9c4f940ac37f61646b3841e0dedfbb8f39 | feat: support JWT authentication via both Authorization header and HttpOnly cookies |
| 2026-04-26 18:32 | b9e50c52ec4576b7ae6e3997a618011424dcefb2 | refactor: reorder calculator route and add navigation logging to profile card and button |
| 2026-04-26 18:25 | b3ee35cb420ac578026325eda79c66a7819f3855 | feat: style registration fields in Login and add interactive navigation to Account card in Dashboard |
| 2026-04-26 18:17 | 291e78e4a9e6e879b9488000835a34830c2a0e15 | refactor: remove unused CardFooter component import from Profile page |
| 2026-04-26 18:13 | 4bcbf4874d8f9a589f477672fc9289e7eb828b73 | signup updates |
| 2026-04-26 17:53 | f56b9dcf0a536c5fb4c76aa70e1726d401c1a0d0 | refactor: remove handleViewResult function from history page |
| 2026-04-26 17:52 | 51c3502262d7f2cbbad31f548d12e744b9ec7fe3 | feat: implement expandable calculation history cards and add SQLTools configuration settings |
| 2026-04-26 17:40 | 17e4ee8283429bcce005256b1efd7d3e4f6191a8 | refactor: replace directional wall labels with indexed identifiers in U-value calculations and UI tables |
| 2026-04-26 17:36 | ed0f1e157fc52271ecb71e480cbfac3de75cc619 | refactor: remove unused surface prop from SurfaceExposureSelector component |
| 2026-04-26 17:35 | 4df1ae8c77c4b791db2a6b4cf15fbbc74630c372 | feat: add SurfaceExposureSelector component and simplify wall labels in Wizard UI |
| 2026-04-26 17:30 | 726964637d3fc2904605463cb813d61be9bfae02 | feat: add 2D floor plan preview step and update wizard flow to 9 steps |
| 2026-04-26 17:25 | 5ddcf146058b244696cd7a2c8878f3f720ecdf86 | refactor: remove unused glazingTypes variable from GlazingSelector component |
| 2026-04-26 17:24 | b5ed8e75530ba5670b64cf75f43ede9573c59653 | feat: add interactive glazing selector with exposure filtering and update window configuration UI |
| 2026-04-26 17:17 | 11c74eb59997b4dfbb3c4622a7be262659c99b83 | feat: add 3D rotation to room visualizer and reorder wall labels to match spatial logic |
| 2026-04-26 17:10 | 028cbe81eac0f28863cc920aeccb227129a75bd5 | renamed from NSEW to WALL 1234 |
| 2026-04-26 16:54 | 8cb99a1e08d880a4a5fdb2f315cb44577996a83d | frontend changes 2 |
| 2026-04-26 16:28 | 85a3a72ee8acf903620747222634cbf1bf8b6279 | frontend change |
| 2026-04-26 15:41 | cb2970086e8a9ec7eee7d594949efc2f242cadf4 | setuop ec2 added |
| 2026-04-26 15:07 | 11d5170622cef2a1b1fb1ff7bf81dcdb3be193d7 | deploy.yml changed |
| 2026-04-26 15:03 | ec128c4ea06662d0dbf319f125da1995ebc6055e | vibe coded frontend -no review |
| 2026-04-06 06:56 | 4c0551dfaef0422d406284b6d9c199007598d7df | bug fix |
| 2026-04-06 06:42 | 536218f210c921ae8431bc3b5d30ace99ac604af | bug fix |
| 2026-04-06 06:38 | febc695d56db23fd1715a12cee9eedc660fff5e9 | bug fix |
| 2026-04-06 06:33 | e303cfcf28c5f672f861db1cd149b72be6a87c7e | bug fix |
| 2026-04-06 06:30 | ad30be7c2c55a8707a504cf2df03912ad6cec4f6 | history added |
| 2026-04-06 06:25 | bcee22abfa10335087bbc6292955eb8bad744b3d | rebuild |
| 2026-04-06 06:07 | 620fcf1c698e91ab45c8eb64c35416f8944b426f | rebuild |
| 2026-04-06 06:06 | 34dfb7c1f571953247828b316379385104ad0364 | bug fix |
| 2026-04-06 06:03 | 8c50f481c2909fb43b301fcd69262e7e86db25a4 | bug fix |
| 2026-04-06 04:57 | 490f1c10405ce6cf87d2f4e90459262b90748cac | token set to HttpOnly cookie |
| 2026-04-06 04:42 | 9b478b26a5d073cc15b5ed8ced21dfa05bc00e60 | adding auth to calcultor |
| 2026-04-06 04:27 | 8684c01cf83ad5faf45ecc390670bd5e4a9c054c | fixinf dashboard path |
| 2026-04-06 04:17 | 1035b7bc36f33d88f3b97ad472d58bd44f2c529b | bug fix |
| 2026-04-05 19:52 | 87665d60ffb1ee2961023972e002c82c6b110b53 | core calculaotr updated |
| 2026-04-03 04:57 | 881f2af3855ccd9532e98962d39c6d9db5e410a4 | rename |
| 2026-04-03 04:51 | ec272ad287724a2e0da618d8846e2acd934f1ceb | bug fix |
| 2026-04-03 04:47 | 3c456a07c686ac409f5c75ba03e23690e1270889 | bug fix |
| 2026-04-03 04:32 | 803b01ae6b96fd25eb9000208dab3346a308215f | github action updated to pull frontend |
| 2026-04-03 04:31 | 3e1e480fead9a0538143da7add2a671da34ae29d | fronent updated |
| 2026-04-03 04:24 | 0eba541af9479301c5095f950cf5fa56d2c76b73 | dashboard deleted |
| 2026-04-03 04:21 | 7ee670124d9bae99a6aabee2c6171c0d96ef7443 | bug fix |
| 2026-04-03 03:40 | 73f9ce5c6fa6ee3cb29220b40ecff96378c51d73 | bug fix main.go |
| 2026-04-03 03:36 | caa3ec220397048a5fbe20d455414e891332c7dd | core calcultor added |
| 2026-04-01 06:58 | a026e585b32758cad3f647ac8043b2d755b0fe96 | elastic IP updated |
| 2026-04-01 06:48 | f840263654c947b1d9dca0bd3715e2f47beeb27b | Mock test for Github Action |
| 2026-04-01 06:37 | 658a2355bddd2ed40b4c1de7e958c7224c6b4810 | Fixed build step in Github action |
| 2026-04-01 06:34 | d9def339a9f5a61a76d9f640b8e95976fe5b0f7e | Github Action deploy.yml fixed |
| 2026-04-01 06:30 | 712ed1a3ddbaefb261fb97ebba2ad0b31eaf1f47 | Add GitHub Actions deployment pipeline |
| 2026-03-30 20:11 | f3fd1f3b61a75cf8073d8c3bbdc79ff4577db012 | admin frontend update |
| 2026-03-30 20:06 | af9d538513b2cce70af5b62ae14e2ebaaf7a594f | frontend update |
| 2026-03-30 19:59 | 4b7d5b31514aabc29a2320ead34df04b73e94609 | frontend path update |
| 2026-03-30 19:44 | dad93770c8b33302a581d4022c94096fb01d873f | .exe updated |
| 2026-03-30 19:40 | 2556c37559535e50e35f5782ee9a854962198762 | db source updated |
| 2026-03-30 04:58 | 835569ba1d31185cb751df01b6dec8d0dabfc362 | frontend |
| 2026-03-30 03:30 | 5e4909c836970fb566b2cbde49e284d9267cf8ab | second commit |
| 2026-03-30 02:25 | 50d58738ff7bbd0f437c446948a478815ff2baa8 | first commit |
| 2026-03-29 04:08 | 0abc499f6dfd01cdb6f50490c8258f6012070d11 | first commit |
