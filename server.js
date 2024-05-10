const express = require('express')
const { createClient} = require('@supabase/supabase-js')
require('dotenv').config()
const session = require('express-session')

const app = express()
const PORT = 5000

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY)

app.use(express.urlencoded({extended: true}))
app.set('view engine', 'ejs')
app.set('views', './views')
app.use(session({
    secret: 'your secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 600000
    }


}))

app.get('/', (req,res) => {
    res.render('index', {records: null})
})

app.get('/loginPage', (req,res) => {
    res.render('login')
})

app.get('/updatePage', (req,res) => {
    if (req.session.authenticated) {
        res.render('update', {record: null, message: null})
    } else {
        res.render('login')
    }       
})

app.post('/login', async (req, res) => {

    const {username, password} = req.body
    
    let { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password
    })

    if(error){
        console.error('login error:', error.message)
        return res.status(401).send('Loin failure. Please contact administrator')
    }

    req.session.userId = 'admin' //use UUID for multiple users
    req.session.authenticated = true

    res.redirect('/updatePage')
 
})

app.get('/logout', (req, res) => {
    req.session.destroy((error) => {
    if (err) {
        console.error('Session destruction error', err)
        return res.status(500).send('Could not log out, please try again')
    }
    
    res.redirect('/')
  })
})

app.get('/search', async (req, res) => {
    const { lastName, firstName, birthYear, deathYear} = req.query
    let query = supabase
        .from('grave_registry')
        .select(`
        name_last,
        name_maiden,
        name_first,
        name_middle,
        title,
        birth_date,
        death_date,
        age,
        is_veteran,
        section,
        lot,
        moved_from,
        moved_to_lot,
        notes
        `)
        .order('name_last', {ascending: true})

    if(lastName) {
        query = query.ilike('name_last', `%${lastName}%`)
    }
    if(firstName) {
        query = query.ilike('name_first', `%${firstName}%`)
    }  
    if (birthYear) {
        query = query.eq('birth_year', birthYear)    //! checkout birthYear and deathDate
    }  
    if (deathYear) {
        query = query.eq('death_year', deathYear)
    }
    //select * from grave_register where name_last like ('%lastName%') order by name_last asc  
    
    try {
        let { data, error } = await query
        if (error){
            throw error
        }
        console.log(data)
        res.render('index', {records: data})
    }catch (error) {
        console.error('Error:', error.message)
        res.status(500).send('Internal Server Error')
    }
})

app.get('/getUpdateRecord', async (req,res) => {
    const memorialID = req.query.memorialID

    let query = supabase
    .from('grave_registry')
    .select(`
    name_last,
    name_maiden,
    name_first,
    name_middle,
    title,
    birth_date,
    death_date,
    age,
    is_veteran,
    section,
    lot,
    moved_from,
    moved_to_lot,
    notes
    `)
    .eq('memorial_ID', memorialID)

    try {
        let {data, error} = await query
        if (error) {
            throw error
        }
        let dataObject = data[0]
        if (data) {
            res.render('update', {record: dataObject})
        } else {
            res.render('update', {record: null, message:'No matching record found. Please check the value and try again.'})
        }
    } catch (error) {
        console.error('Error:', error.message)
    }
})

app.post('/updateRecord', async (req,res) => {
    if (req.session.authenticated) {
        try {
            const updatedData = await updateRecordInSupabase(req,body)
            res.render('update', {record: null, message: 'Record Updated Successfully'})
        } catch (error) {
            console.error('Error updating record:', error)
            res.render('update', {record: null, message: 'Error Updating Record. Please try again.' })
        }
    } else {
        res.render('login')
    }
})

async function updateRecordInSupabase(formData) {
    try {
        const recordId = formData.memorialID
        delete formData.memorialID
        const {data, error} = await supabase
            .from('grave_registry')
            .update(formData)
            .eq('memorial_ID', recordId)
            if (error) throw error
    } catch (error) {
        console.error('Error updating record in Supabase:', error);
        throw error; // Rethrow the error to be handled by the calling function
    }
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
