const main = document.getElementById('main');
const website = document.getElementById('website');
const bg = document.getElementById('bg');
const logo = document.getElementById('Logo');
const scroll = document.getElementById('scroll');
const mountains = [1, 2, 3, 4, 5, 6, 7, 8].map(n => document.getElementById(`mtn_${n}`));
const signin = document.getElementById('Sign_In');
const signup = document.getElementById('Sign_Up');
const guest = document.getElementById('Enter_as_guest');
const caption = document.getElementById('Meet_new_people_everyday_Liste');
const signInBox = document.getElementById('sign_in_container');
const signUpBox = document.getElementById('sign_up_container');

// Parallax: [base top, speed] for mtn_1 .. mtn_8.
const mountainMotion = [[304, -7], [328, -3], [229, -1], [0, 1.5], [128, 1], [103, 2.3], [47, 2.1], [66, 2]];

window.addEventListener('scroll', () => {
	const value = window.scrollY;
	if (main.style.height > 1155 + 'px') {
		main.style.height = 2025 - value * 21 + 'px';
	} else {
		main.style.height = 1155 + 'px';
	}
	website.style.top = value + 'px';
	bg.style.top = value * -10 + 'px';
	logo.style.height = 204 + value * 5 + 'px';
	logo.style.width = 204 + value * 5 + 'px';
	logo.style.left = 858 - value * 2.5 + 'px';
	logo.style.marginTop = value / 75 + '%';
	mountains.forEach((mtn, i) => {
		const [top, speed] = mountainMotion[i];
		mtn.style.top = top + value * speed + 'px';
	});
	scroll.style.top = 960 + value * -5 + 'px';
	scroll.style.opacity = 1 - value * 0.03;
	scroll.style.zIndex = 8 - value * 0.15;
	signin.style.top = 1212 + value * -12 + 'px';
	signup.style.top = 1212 + value * -12 + 'px';
	guest.style.top = 1333 + value * -12 + 'px';
	signin.style.opacity = -0.5 + value * 0.04;
	signup.style.opacity = -0.5 + value * 0.04;
	guest.style.opacity = -0.5 + value * 0.04;
	caption.style.opacity = 1 - value * 0.03;
});

scroll.addEventListener('click', () => window.scrollTo(0, 1155));

signin.addEventListener('click', () => { signInBox.style.display = 'flex'; });
signup.addEventListener('click', () => { signUpBox.style.display = 'flex'; });

// Close a form when clicking anywhere outside it.
window.addEventListener('mouseup', event => {
	for (const box of [signInBox, signUpBox]) {
		if (!box.contains(event.target)) box.style.display = 'none';
	}
});

const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirm_password');

function validatePassword() {
	confirmPassword.setCustomValidity(password.value === confirmPassword.value ? '' : "Passwords don't match");
}

password.addEventListener('change', validatePassword);
confirmPassword.addEventListener('keyup', validatePassword);

// The server redirects back here with ?error=... when login or signup fails.
const errors = {
	'bad-login': ['sign_in', 'Invalid email or password.'],
	'email-taken': ['sign_up', 'That email is already registered.'],
	'invalid-signup': ['sign_up', 'Please fill in every field (password: 6+ characters).'],
};
const error = errors[new URLSearchParams(window.location.search).get('error')];
if (error) {
	const [form, message] = error;
	document.getElementById(`${form}_error`).textContent = message;
	window.addEventListener('load', () => {
		window.scrollTo({ top: 1155, behavior: 'instant' });
		document.getElementById(`${form}_container`).style.display = 'flex';
	});
	history.replaceState(null, '', '/');
}
