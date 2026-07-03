export const renderForumPublic = (req, res) => {
  res.render('public/forum', {
    pageTitle:  'Foro',
    activePage: 'forum',
  });
};