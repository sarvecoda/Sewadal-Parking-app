package com.example.snsparkingappblr

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class MainViewModel : ViewModel() {

    private val repo = VehicleRepository

    private val _all   = MutableStateFlow<List<Pair<String, VehicleData>>>(emptyList())
    val       all:   StateFlow<List<Pair<String, VehicleData>>> = _all

    private val _today = MutableStateFlow<List<Pair<String, VehicleData>>>(emptyList())
    val       today: StateFlow<List<Pair<String, VehicleData>>> = _today

    init {
        repo.stream(today = false, _all::value::set)   { it.printStackTrace() }
        repo.stream(today = true , _today::value::set) { it.printStackTrace() }
    }

    fun add(data: VehicleData) = viewModelScope.launch {
        repo.add(data, today = false)
        repo.add(data, today = true)
    }

    fun deleteTodayDoc(id: String) = viewModelScope.launch {
        repo.delete(id, today = true)
    }

    fun deleteAllToday() = viewModelScope.launch {
        repo.deleteAll(today = true)
    }
}
